import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { runEligibilityEvaluation } from "@/lib/eligibility-runner";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import type { EligibilityLogic } from "@/lib/eligibility";

// Publishes a rule version and freezes the evaluation as a snapshot — once
// created, a snapshot's results never change even if a student's CGPA is
// corrected later (see prisma/schema.prisma EligibilitySnapshot comment).
// Applications created after this point reference the resulting
// EligibilityResult row via Application.eligibilityResultId.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "eligibility.publish");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const { ruleId, confirmed } = await request.json().catch(() => ({}));
  if (!ruleId) return NextResponse.json({ error: "validation_error", message: "ruleId required" }, { status: 400 });

  const rule = await db.driveEligibilityRule.findUnique({ where: { id: ruleId, driveId } });
  if (!rule) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const logic = rule.logic as unknown as EligibilityLogic;
  const results = await runEligibilityEvaluation(db, driveId, logic);

  // If an earlier rule was already published for this drive, warn before
  // silently narrowing who's eligible — a TPO republishing a stricter rule
  // should see "N students who were eligible before are not anymore"
  // before it takes effect, not discover it after the fact.
  if (!confirmed) {
    const previousSnapshot = await db.eligibilitySnapshot.findFirst({ where: { driveId }, orderBy: { createdAt: "desc" } });
    if (previousSnapshot) {
      const previouslyEligible = await db.eligibilityResult.findMany({
        where: { snapshotId: previousSnapshot.id, eligible: true },
        select: { studentId: true },
      });
      const previouslyEligibleIds = new Set(previouslyEligible.map((r: { studentId: string }) => r.studentId));
      const newlyEligibleIds = new Set(results.filter((r) => r.eligible).map((r) => r.studentId));
      const newlyIneligibleCount = [...previouslyEligibleIds].filter((id) => !newlyEligibleIds.has(id)).length;

      if (newlyIneligibleCount > 0) {
        return NextResponse.json({ needsConfirmation: true, newlyIneligibleCount, previouslyEligibleCount: previouslyEligibleIds.size }, { status: 200 });
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.driveEligibilityRule.update({
      where: { id: rule.id },
      data: { isPublished: true, publishedAt: new Date(), publishedById: session.userId },
    });
    const snapshot = await tx.eligibilitySnapshot.create({
      data: { collegeId: session.collegeId, driveId, ruleVersion: rule.version, studentCount: results.length },
    });
    await tx.eligibilityResult.createMany({
      data: results.map((r) => ({
        collegeId: session.collegeId,
        snapshotId: snapshot.id,
        studentId: r.studentId,
        eligible: r.eligible,
        explanation: r.checks,
      })),
    });
  });

  await recomputeDriveCounters(db, driveId);

  const eligibleCount = results.filter((r) => r.eligible).length;
  return NextResponse.json({ ok: true, studentCount: results.length, eligibleCount });
}
