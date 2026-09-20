import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { runEligibilityEvaluation } from "@/lib/eligibility-runner";
import type { EligibilityLogic } from "@/lib/eligibility";

// Dry-run: evaluates a rule (by ruleId, or an inline `logic` tree) against
// the drive's candidate population WITHOUT persisting a snapshot — lets the
// TPO see "how many students would be eligible" before committing.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "eligibility.preview");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  let logic: EligibilityLogic;
  if (body.ruleId) {
    const rule = await db.driveEligibilityRule.findUnique({ where: { id: body.ruleId, driveId } });
    if (!rule) return NextResponse.json({ error: "not_found" }, { status: 404 });
    logic = rule.logic as unknown as EligibilityLogic;
  } else if (body.logic) {
    logic = body.logic as EligibilityLogic;
  } else {
    return NextResponse.json({ error: "validation_error", message: "ruleId or logic required" }, { status: 400 });
  }

  const results = await runEligibilityEvaluation(db, driveId, logic);
  const eligibleCount = results.filter((r) => r.eligible).length;

  return NextResponse.json({ totalEvaluated: results.length, eligibleCount, notEligibleCount: results.length - eligibleCount, results });
}
