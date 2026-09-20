import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";
import { evaluateEligibility, type EligibilityCheck, type EligibilityLogic } from "@/lib/eligibility";

// The candidate population for a drive: students in one of the drive's
// eligible courses, in the drive's batch, with placement access. Shared by
// both preview (dry run) and publish (persisted) so they can never
// evaluate against a different population.
export async function getCandidatePopulation(db: TenantDb, driveId: string) {
  const drive = await db.drive.findUniqueOrThrow({
    where: { id: driveId },
    select: { batchId: true, batch: { select: { year: true } }, departmentId: true, eligibleCourses: { select: { courseId: true } } },
  });
  const courseIds = drive.eligibleCourses.map((c) => c.courseId);

  const students = await db.student.findMany({
    where: { batchId: drive.batchId, courseId: { in: courseIds }, hasPlacementAccess: true },
    select: {
      id: true,
      aggregate: true,
      liveBacklogs: true,
      closedBacklogs: true,
      courseId: true,
      tenthScore: true,
      twelfthScore: true,
      diplomaScore: true,
      skills: { select: { skillId: true } },
      _count: { select: { experiences: true, certifications: true } },
    },
  });

  return { drive, students };
}

// A manual override only counts while it is live: rows carry an optional
// expiresAt, and a student may accumulate several over a drive's life, so
// the most recently created live row is the one that decides. Ordering
// ascending and letting later rows overwrite earlier ones in the Map gives
// exactly that without a second pass.
export async function getActiveOverrides(db: TenantDb, driveId: string) {
  const now = new Date();
  const rows = await db.eligibilityOverride.findMany({
    where: { driveId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: "asc" },
    select: { studentId: true, decision: true, reason: true },
  });

  const byStudent = new Map<string, { decision: string; reason: string }>();
  for (const row of rows) byStudent.set(row.studentId, { decision: row.decision, reason: row.reason });
  return byStudent;
}

export type EligibilityEvaluationRow = {
  studentId: string;
  eligible: boolean;
  checks: EligibilityCheck[];
  // What the rule tree alone decided, before any manual override — kept
  // alongside the final verdict so the UI can show "eligible by override"
  // rather than silently contradicting the printed checks.
  ruleEligible: boolean;
  overridden: boolean;
  overrideReason: string | null;
};

export async function runEligibilityEvaluation(
  db: TenantDb,
  driveId: string,
  logic: EligibilityLogic,
): Promise<EligibilityEvaluationRow[]> {
  const [{ drive, students }, overrides] = await Promise.all([
    getCandidatePopulation(db, driveId),
    getActiveOverrides(db, driveId),
  ]);

  return students.map((s) => {
    const { eligible: ruleEligible, checks } = evaluateEligibility(logic, {
      cgpa: s.aggregate,
      active_backlogs: s.liveBacklogs,
      batch_year: drive.batch.year,
      course_id: s.courseId,
      department_id: drive.departmentId,
      tenth_score: s.tenthScore,
      twelfth_score: s.twelfthScore,
      diploma_score: s.diplomaScore,
      closed_backlogs: s.closedBacklogs,
      skill_ids: s.skills.map((sk) => sk.skillId),
      has_experience: s._count.experiences > 0,
      has_certification: s._count.certifications > 0,
    });

    // An override is applied AFTER the rules run, so `checks` still records
    // exactly why the rules passed or failed. Only the final verdict moves —
    // the frozen EligibilityResult.explanation shape stays untouched, which
    // matters because applications/[id] renders it as-is.
    const override = overrides.get(s.id);
    if (!override) {
      return { studentId: s.id, eligible: ruleEligible, checks, ruleEligible, overridden: false, overrideReason: null };
    }

    return {
      studentId: s.id,
      eligible: override.decision === "ELIGIBLE",
      checks,
      ruleEligible,
      overridden: true,
      overrideReason: override.reason,
    };
  });
}
