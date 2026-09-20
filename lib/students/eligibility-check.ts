import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";
import { evaluateEligibility, type EligibilityCheck, type EligibilityLogic } from "@/lib/eligibility";

const ACTIVE_DRIVE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SELECTION_ONGOING"] as const;

export type DriveEligibilityResult = {
  driveId: string;
  driveTitle: string;
  companyName: string;
  eligible: boolean;
  reasons: string[];
  /** Set when a TPO manually forced this student in or out of the drive. */
  overrideReason: string | null;
};

const FIELD_LABEL: Record<string, string> = {
  cgpa: "CGPA",
  active_backlogs: "active backlogs",
  batch_year: "batch year",
  course_id: "course",
  department_id: "department",
  tenth_score: "10th %",
  twelfth_score: "12th %",
  diploma_score: "diploma %",
  closed_backlogs: "historical (cleared) backlogs",
  skill_ids: "required skills",
  has_experience: "work experience on file",
  has_certification: "certification on file",
};

function explain(check: EligibilityCheck): string {
  const label = FIELD_LABEL[check.field] ?? check.field;
  if (check.passed) return `${label} OK (${check.actual})`;
  return `minimum/required ${label} ${check.operator} ${check.expected}, student has ${check.actual ?? "no value on file"}`;
}

// The reverse of lib/eligibility-runner.ts's getCandidatePopulation/
// runEligibilityEvaluation, which check every student against ONE drive's
// rule — this checks ONE student against every currently-active drive that
// has a published eligibility rule, for the Student 360 Eligibility tab.
// Reuses the exact same evaluateEligibility engine so "why is this student
// not eligible" reads identically to the Drive-side explanation.
export async function checkStudentEligibility(db: TenantDb, studentId: string): Promise<DriveEligibilityResult[]> {
  const student = await db.student.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      aggregate: true,
      liveBacklogs: true,
      closedBacklogs: true,
      courseId: true,
      departmentId: true,
      batchId: true,
      batch: { select: { year: true } },
      tenthScore: true,
      twelfthScore: true,
      diplomaScore: true,
      skills: { select: { skillId: true } },
      _count: { select: { experiences: true, certifications: true } },
    },
  });

  const drives = await db.drive.findMany({
    where: { status: { in: [...ACTIVE_DRIVE_STATUSES] }, batchId: student.batchId },
    select: {
      id: true,
      title: true,
      company: { select: { name: true } },
      eligibilityRules: { where: { isPublished: true }, orderBy: { version: "desc" }, take: 1 },
    },
  });

  // A manual override beats the rule here exactly as it does in
  // lib/eligibility-runner.ts. Without this the student's own page would
  // still read "not eligible" after a TPO had forced them in, which is the
  // one place that contradiction would be noticed.
  const now = new Date();
  const overrides = await db.eligibilityOverride.findMany({
    where: {
      studentId,
      driveId: { in: drives.map((d) => d.id) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
    select: { driveId: true, decision: true, reason: true },
  });
  const overrideByDrive = new Map(overrides.map((o) => [o.driveId, o]));

  return drives
    .filter((d) => d.eligibilityRules.length > 0)
    .map((d) => {
      const rule = d.eligibilityRules[0];
      const { eligible, checks } = evaluateEligibility(rule.logic as EligibilityLogic, {
        cgpa: student.aggregate,
        active_backlogs: student.liveBacklogs,
        batch_year: student.batch.year,
        course_id: student.courseId,
        department_id: student.departmentId,
        tenth_score: student.tenthScore,
        twelfth_score: student.twelfthScore,
        diploma_score: student.diplomaScore,
        closed_backlogs: student.closedBacklogs,
        skill_ids: student.skills.map((s) => s.skillId),
        has_experience: student._count.experiences > 0,
        has_certification: student._count.certifications > 0,
      });
      const override = overrideByDrive.get(d.id);
      const effectiveEligible = override ? override.decision === "ELIGIBLE" : eligible;
      return {
        driveId: d.id,
        driveTitle: d.title,
        companyName: d.company.name,
        eligible: effectiveEligible,
        reasons: checks.filter((c) => effectiveEligible || !c.passed).map(explain),
        overrideReason: override?.reason ?? null,
      };
    });
}
