import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { generateText } from "@/lib/ai/client";
import { buildCompanyContext } from "@/lib/companies/ai-context";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const context = await buildCompanyContext(db, id);
  if (!context) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { text, stub } = await generateText({
    system:
      "You are a placement-cell assistant summarizing a recruiter/company partnership for a TPO, using ONLY the data snapshot given below — never invent names, numbers, or events not present in it. Write 2-3 plain-text sentences (no markdown) assessing the partnership's current health and what's notable about it right now. Then on a new line write 'Suggested action: ' followed by one concrete, specific next step the TPO could take, grounded in the data (e.g. referencing an overdue follow-up, a hiring slowdown, or active drives). If the data is too sparse to say anything meaningful, say so plainly instead of guessing.",
    prompt: `Company data snapshot:\n${context}`,
    stubFallback: () =>
      `AI generation isn't configured yet (no ANTHROPIC_API_KEY / OPENAI_API_KEY set), so here's the raw data snapshot instead:\n\n${context}`,
  });

  return NextResponse.json({ insight: text, stub });
}
