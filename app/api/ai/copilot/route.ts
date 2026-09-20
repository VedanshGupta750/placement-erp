import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { generateJSON } from "@/lib/ai/client";
import { buildPlacementContext } from "@/lib/ai/placement-context";
import { copilotQuestionSchema } from "@/lib/validators/ai";

type CopilotAction = { label: string; href: string };
type CopilotResponse = { answer: string; actions: CopilotAction[] };

// Internal routes the Copilot is allowed to link to — the model can only
// ever propose an action if its href starts with one of these, and only
// query params from ALLOWED_PARAMS survive; anything else is stripped
// server-side before the client ever sees it. This is what keeps
// "provide actions, not just chat" safe: the model picks a destination and
// a label, it never gets to construct an arbitrary URL or trigger a
// mutation directly.
const ALLOWED_PATHS = ["/students", "/drives", "/companies", "/offers", "/interviews", "/applications", "/contacts", "/reports", "/events"];
const ALLOWED_PARAMS = new Set(["status", "tab", "type", "view"]);

function sanitizeAction(a: unknown): CopilotAction | null {
  if (!a || typeof a !== "object") return null;
  const label = "label" in a && typeof a.label === "string" ? a.label.slice(0, 60) : null;
  const hrefRaw = "href" in a && typeof a.href === "string" ? a.href : null;
  if (!label || !hrefRaw) return null;

  let url: URL;
  try {
    url = new URL(hrefRaw, "http://internal");
  } catch {
    return null;
  }
  if (!ALLOWED_PATHS.includes(url.pathname)) return null;

  const cleanParams = new URLSearchParams();
  for (const [k, v] of url.searchParams.entries()) {
    if (ALLOWED_PARAMS.has(k)) cleanParams.set(k, v.slice(0, 60));
  }
  const qs = cleanParams.toString();
  return { label, href: qs ? `${url.pathname}?${qs}` : url.pathname };
}

export async function POST(request: Request) {
  const session = await requireSession();

  try {
    await requirePermission(session, "report.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = copilotQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const context = await buildPlacementContext(session.collegeId);

  const { data, stub } = await generateJSON<CopilotResponse>({
    system:
      "You are the TPO Copilot inside a placement-cell ERP. Answer the placement officer's question using ONLY the data snapshot given below — never invent numbers. If the data doesn't cover the question, say so plainly. Keep the answer to 2-4 sentences, plain text, no markdown headers. " +
      `Also suggest 0-3 relevant navigation actions the officer could take next, each as {label, href}. href MUST be one of these exact paths, optionally with a query string: ${ALLOWED_PATHS.join(", ")}. ` +
      "Only include an action if it's genuinely useful given the answer (e.g. pointing at /drives if the question was about a specific drive's status, /students if it was about a student segment) — an empty actions array is correct when nothing fits.",
    prompt: `Placement data snapshot:\n${context}\n\nQuestion: ${parsed.data.question}\n\nRespond as JSON: {"answer": string, "actions": [{"label": string, "href": string}]}`,
    stubFallback: () => ({
      answer: `AI generation isn't configured yet (no ANTHROPIC_API_KEY / OPENAI_API_KEY set), so here's the raw data snapshot instead:\n\n${context}`,
      actions: [],
    }),
  });

  const actions = Array.isArray(data.actions) ? data.actions.map(sanitizeAction).filter((a): a is CopilotAction => a !== null).slice(0, 3) : [];

  return NextResponse.json({ answer: data.answer, actions, stub });
}
