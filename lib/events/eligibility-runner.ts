import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";
import { evaluateEligibility, type EligibilityLogic } from "@/lib/eligibility";

// The candidate population for an event: students in one of the event's
// eligible batches/departments (empty list = no restriction on that axis),
// mirroring lib/eligibility-runner.ts's Drive population query so "eligible
// count" means the same thing across the app.
export async function getEventCandidatePopulation(db: TenantDb, eventId: string) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { eligibleBatchIds: true, eligibleDepartmentIds: true, eligibilityLogic: true },
  });

  const students = await db.student.findMany({
    where: {
      hasPlacementAccess: true,
      ...(event.eligibleBatchIds.length > 0 ? { batchId: { in: event.eligibleBatchIds } } : {}),
      ...(event.eligibleDepartmentIds.length > 0 ? { departmentId: { in: event.eligibleDepartmentIds } } : {}),
    },
    select: {
      id: true,
      userId: true,
      aggregate: true,
      liveBacklogs: true,
      closedBacklogs: true,
      courseId: true,
      departmentId: true,
      batch: { select: { year: true } },
      tenthScore: true,
      twelfthScore: true,
      diplomaScore: true,
      skills: { select: { skillId: true } },
      _count: { select: { experiences: true, certifications: true } },
    },
  });

  return { event, students };
}

export async function getEligibleStudentsForEvent(db: TenantDb, eventId: string) {
  const { event, students } = await getEventCandidatePopulation(db, eventId);
  const logic = event.eligibilityLogic as EligibilityLogic | null;
  if (!logic) return students;

  return students.filter((s) => {
    const { eligible } = evaluateEligibility(logic, {
      cgpa: s.aggregate,
      active_backlogs: s.liveBacklogs,
      batch_year: s.batch.year,
      course_id: s.courseId,
      department_id: s.departmentId,
      tenth_score: s.tenthScore,
      twelfth_score: s.twelfthScore,
      diploma_score: s.diplomaScore,
      closed_backlogs: s.closedBacklogs,
      skill_ids: s.skills.map((sk) => sk.skillId),
      has_experience: s._count.experiences > 0,
      has_certification: s._count.certifications > 0,
    });
    return eligible;
  });
}

export async function getEventEligibleCount(db: TenantDb, eventId: string) {
  const students = await getEligibleStudentsForEvent(db, eventId);
  return students.length;
}
