import "server-only";

export type AiResult = { text: string; stub: boolean };

// Real AI generation needs a live API key — same situation as email/SMS
// delivery elsewhere in this codebase. Until a key is set, every AI feature
// (resume parsing, JD parsing, the TPO copilot) falls back to a
// deterministic, clearly-labeled stub derived from the same real data that
// would otherwise be sent to the model, so the feature is usable end-to-end
// in dev/demo and upgrades to real generation the moment a key lands.
//
// Two providers are supported since either credential unlocks real
// generation without touching any call site — checked in this order:
// Anthropic (Claude) first if both happen to be set, then OpenAI, then stub.
export async function generateText(params: { system: string; prompt: string; stubFallback: () => string }): Promise<AiResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) return generateWithAnthropic(anthropicKey, params);
  if (openaiKey) return generateWithOpenAI(openaiKey, params);

  console.log(`[ai:stub] system="${params.system.slice(0, 80)}…" prompt="${params.prompt.slice(0, 120)}…" (set ANTHROPIC_API_KEY or OPENAI_API_KEY to generate for real)`);
  return { text: params.stubFallback(), stub: true };
}

// Same contract as generateText, but instructs the model to return ONLY a
// JSON object and parses it. `stubFallback` returns the object directly (not
// a JSON string) since there's no real model call to format for in stub mode.
export async function generateJSON<T>(params: { system: string; prompt: string; stubFallback: () => T }): Promise<{ data: T; stub: boolean }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    console.log(`[ai:stub:json] system="${params.system.slice(0, 80)}…" (set ANTHROPIC_API_KEY or OPENAI_API_KEY to generate for real)`);
    return { data: params.stubFallback(), stub: true };
  }

  const jsonSystem = `${params.system}\n\nRespond with ONLY a single valid JSON object — no markdown fences, no commentary before or after.`;
  const result = await generateText({ system: jsonSystem, prompt: params.prompt, stubFallback: () => JSON.stringify(params.stubFallback()) });

  try {
    const cleaned = result.text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    return { data: JSON.parse(cleaned) as T, stub: result.stub };
  } catch {
    console.error(`[ai:json:parse_error] could not parse model output as JSON, falling back to stub`);
    return { data: params.stubFallback(), stub: true };
  }
}

async function generateWithAnthropic(
  apiKey: string,
  params: { system: string; prompt: string; stubFallback: () => string },
): Promise<AiResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1536,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    }),
  });

  if (!res.ok) {
    console.error(`[ai:anthropic:error] ${res.status} ${await res.text()}`);
    return { text: params.stubFallback(), stub: true };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? params.stubFallback();
  return { text, stub: false };
}

async function generateWithOpenAI(
  apiKey: string,
  params: { system: string; prompt: string; stubFallback: () => string },
): Promise<AiResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1536,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`[ai:openai:error] ${res.status} ${await res.text()}`);
    return { text: params.stubFallback(), stub: true };
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? params.stubFallback();
  return { text, stub: false };
}
