// "Forecasts" here means a real pipeline-conversion projection, not a
// time-series prediction — this college's data doesn't support the latter
// honestly (see the commit message: every seeded offer has the same
// creation date, so there's no real day-by-day trend to extrapolate from,
// and inventing one would be exactly the kind of fake number this app has
// avoided everywhere else). Instead: compute this season's REAL observed
// conversion rates (shortlist rate, interview pass rate, offer rate, accept
// rate) from applications that have already resolved one way or another,
// then apply those same rates to applications currently still in progress.
// This is the same technique sales/recruiting pipelines use ("expected
// bookings = pipeline value x historical win rate") — a real analytical
// method, not a black box. Requires a minimum sample size before showing
// a confident number; below that, says so honestly instead of guessing.
const MIN_SAMPLE = 10;
const IN_PROGRESS_STATUSES = ["APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS"];
const RESOLVED_STATUSES = ["SELECTED", "REJECTED", "WITHDRAWN"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPipelineForecast(db: any, batchId: string | null = null) {
  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const placedStudentIds = (
    await db.offer.findMany({ where: { status: { in: ["ACCEPTED", "JOINING_PENDING", "JOINED"] }, ...studentBatchWhere }, select: { studentId: true }, distinct: ["studentId"] })
  ).map((o: { studentId: string }) => o.studentId);

  const [resolvedApplications, inProgressStudents, studentCount, roundOutcomes, selectedCount, passedCount] = await Promise.all([
    db.application.count({ where: { status: { in: RESOLVED_STATUSES }, ...studentBatchWhere } }),
    // Distinct STUDENTS with an in-progress application, excluding anyone
    // already placed — a student with 3 pending applications can only ever
    // add 1 to the placed count, never 3. Counting raw applications here
    // (instead of students) was the bug behind a >100% projected rate.
    db.application.findMany({
      where: { status: { in: IN_PROGRESS_STATUSES }, studentId: { notIn: placedStudentIds }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    db.student.count({ where: { eligibleForPlacements: true, ...(batchId ? { batchId } : {}) } }),
    db.roundCandidate.count({ where: { status: { in: ["PASSED", "FAILED"] }, ...studentBatchWhere } }),
    db.application.count({ where: { status: "SELECTED", ...studentBatchWhere } }),
    db.roundCandidate.count({ where: { status: "PASSED", ...studentBatchWhere } }),
  ]);

  const inProgressCount = inProgressStudents.length;
  const totalResolved = resolvedApplications;
  const selectRate = totalResolved > 0 ? selectedCount / totalResolved : 0;
  const interviewPassRate = roundOutcomes > 0 ? passedCount / roundOutcomes : 0;

  const confident = totalResolved >= MIN_SAMPLE && roundOutcomes >= MIN_SAMPLE;

  // An in-progress student's chance of eventually landing a placement,
  // approximated as this season's observed select-rate among applications
  // that already resolved. Simple and transparent on purpose. Capped at
  // the number of still-unplaced eligible students as a hard sanity bound
  // — a college can never place more students than it has.
  const unplacedEligible = Math.max(0, studentCount - placedStudentIds.length);
  const expectedAdditionalPlacements = confident ? Math.min(Math.round(inProgressCount * selectRate), unplacedEligible) : null;
  const projectedPlacedCount = expectedAdditionalPlacements !== null ? placedStudentIds.length + expectedAdditionalPlacements : null;
  const projectedPlacementPct = projectedPlacedCount !== null && studentCount > 0 ? Math.round((projectedPlacedCount / studentCount) * 1000) / 10 : null;

  return {
    confident,
    sampleSize: totalResolved,
    interviewSampleSize: roundOutcomes,
    selectRatePct: Math.round(selectRate * 1000) / 10,
    interviewPassRatePct: Math.round(interviewPassRate * 1000) / 10,
    inProgressCount,
    currentPlacedCount: placedStudentIds.length,
    currentPlacementPct: studentCount > 0 ? Math.round((placedStudentIds.length / studentCount) * 1000) / 10 : 0,
    expectedAdditionalPlacements,
    projectedPlacedCount,
    projectedPlacementPct,
    eligibleStudentCount: studentCount,
  };
}

// Department-level breakdown of the same projection — applies the one
// college-wide select rate (per-department sample sizes are too small in
// most colleges to support their own independent rate honestly) to each
// department's own in-progress application count.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDepartmentForecast(db: any, selectRate: number, confident: boolean, batchId: string | null = null) {
  if (!confident) return [];

  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const placedStudentIds = (
    await db.offer.findMany({ where: { status: { in: ["ACCEPTED", "JOINING_PENDING", "JOINED"] }, ...studentBatchWhere }, select: { studentId: true }, distinct: ["studentId"] })
  ).map((o: { studentId: string }) => o.studentId);

  const inProgress = await db.application.findMany({
    where: { status: { in: IN_PROGRESS_STATUSES }, studentId: { notIn: placedStudentIds }, ...studentBatchWhere },
    select: { studentId: true, student: { select: { department: { select: { name: true } } } } },
    distinct: ["studentId"],
  });

  const byDept = new Map<string, number>();
  for (const a of inProgress as { student: { department: { name: string } | null } }[]) {
    const key = a.student.department?.name ?? "Unassigned";
    byDept.set(key, (byDept.get(key) ?? 0) + 1);
  }

  return [...byDept.entries()]
    .map(([name, inProgressCount]) => ({ name, inProgressCount, expectedAdditional: Math.round(inProgressCount * selectRate) }))
    .sort((a, b) => b.inProgressCount - a.inProgressCount);
}
