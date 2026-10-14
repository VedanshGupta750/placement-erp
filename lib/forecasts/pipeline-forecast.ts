// "Forecasts" here means a pipeline-conversion projection, not a time-series
// prediction — this college's data doesn't support the latter honestly (every
// seeded offer shares a creation date, so there's no day-by-day trend to
// extrapolate, and inventing one would be exactly the fake number this app
// avoids elsewhere). Instead: measure this season's REAL conversion on work
// that has already finished, then apply it to work still running.
//
// WHY THERE ARE TWO BASES
// -----------------------
// The projection answers "how many more STUDENTS get placed", so the rate it
// multiplies has to be about students too. The first version multiplied a
// per-APPLICATION select rate by a count of students, which mixes units: a
// student with three live applications has a better chance than any one of
// those applications does.
//
//   basis "student"      preferred. Of students whose pipeline has fully
//                        resolved (at least one finished application, none
//                        still running), what share ended up placed? That is
//                        already a per-student number, so it multiplies a
//                        student count directly — no conversion, no
//                        independence assumption.
//
//   basis "application"  fallback, used when too few students have finished
//                        their season to measure the above. Converts the
//                        per-application rate p into a per-student
//                        expectation properly: a student with n live
//                        applications contributes 1 - (1-p)^n, summed across
//                        students. That treats applications as independent,
//                        which they aren't — a strong candidate wins
//                        everywhere and a weak one nowhere — so this basis is
//                        reported as such and the page labels it.
//
// The interview pass rate is DESCRIPTIVE ONLY. It's reported because it's
// useful to see, but deliberately not multiplied into the projection: the
// select rate already reflects the whole funnel, interviews included, so
// compounding the two would double-count the same filtering step.

const MIN_SAMPLE = 10;
// Above this the projection is reported plainly; between MIN and STRONG it is
// flagged indicative, because a rate measured on a dozen outcomes moves a lot
// with one more result.
const STRONG_SAMPLE = 30;

const IN_PROGRESS_STATUSES = ["APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS"];
const RESOLVED_STATUSES = ["SELECTED", "REJECTED", "WITHDRAWN"];
const PLACING_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"];

export type ForecastBasis = "student" | "application";

/** Per-student placement expectation derived from a per-application rate. */
function expectedFromApplicationRate(pendingPerStudent: number[], p: number): number {
  return pendingPerStudent.reduce((sum, n) => sum + (1 - Math.pow(1 - p, n)), 0);
}

export async function getPipelineForecast(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  batchId: string | null = null,
  // The eligible population, as defined by the college's eligibility policy
  // (lib/students/eligibility-policy.ts). Passed in rather than hardcoded to
  // `eligibleForPlacements: true`, so this denominator means the same thing
  // as the "Eligible" count on the Students page.
  eligibleWhere: Record<string, unknown> = { eligibleForPlacements: true },
) {
  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const placedStudentIds: string[] = (
    await db.offer.findMany({
      where: { status: { in: PLACING_OFFER_STATUSES }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    })
  ).map((o: { studentId: string }) => o.studentId);
  const placedSet = new Set<string>(placedStudentIds);

  const [
    resolvedApplications,
    selectedCount,
    roundOutcomes,
    passedCount,
    eligibleStudentCount,
    resolvedStudents,
    anyInProgressStudents,
    inProgressRows,
  ] = await Promise.all([
    db.application.count({ where: { status: { in: RESOLVED_STATUSES }, ...studentBatchWhere } }),
    db.application.count({ where: { status: "SELECTED", ...studentBatchWhere } }),
    db.roundCandidate.count({ where: { status: { in: ["PASSED", "FAILED"] }, ...studentBatchWhere } }),
    db.roundCandidate.count({ where: { status: "PASSED", ...studentBatchWhere } }),
    db.student.count({ where: { AND: [eligibleWhere, ...(batchId ? [{ batchId }] : [])] } }),
    db.application.findMany({
      where: { status: { in: RESOLVED_STATUSES }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    // Every student with live work, placed or not — used to decide whose
    // season is over, which is a different question from who still counts
    // towards the projection.
    db.application.findMany({
      where: { status: { in: IN_PROGRESS_STATUSES }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    // Deliberately not distinct: the per-student application counts are what
    // the application-basis conversion needs.
    db.application.findMany({
      where: { status: { in: IN_PROGRESS_STATUSES }, studentId: { notIn: placedStudentIds }, ...studentBatchWhere },
      select: { studentId: true },
    }),
  ]);

  const stillRunning = new Set<string>(anyInProgressStudents.map((a: { studentId: string }) => a.studentId));
  const settledStudentIds: string[] = resolvedStudents
    .map((a: { studentId: string }) => a.studentId)
    .filter((id: string) => !stillRunning.has(id));
  const settledPlacedCount = settledStudentIds.filter((id) => placedSet.has(id)).length;

  const pendingByStudent = new Map<string, number>();
  for (const row of inProgressRows as { studentId: string }[]) {
    pendingByStudent.set(row.studentId, (pendingByStudent.get(row.studentId) ?? 0) + 1);
  }
  const inProgressStudents = pendingByStudent.size;
  const inProgressApplications: number = inProgressRows.length;

  const applicationSelectRate = resolvedApplications > 0 ? selectedCount / resolvedApplications : 0;
  const studentPlacementRate = settledStudentIds.length > 0 ? settledPlacedCount / settledStudentIds.length : 0;
  const interviewPassRate = roundOutcomes > 0 ? passedCount / roundOutcomes : 0;

  // Student basis wins whenever it has the sample to stand on.
  const useStudentBasis = settledStudentIds.length >= MIN_SAMPLE;
  const basis: ForecastBasis = useStudentBasis ? "student" : "application";
  const sampleSize = useStudentBasis ? settledStudentIds.length : resolvedApplications;
  const conversionRate = useStudentBasis ? studentPlacementRate : applicationSelectRate;
  const confident = sampleSize >= MIN_SAMPLE;
  const indicative = confident && sampleSize < STRONG_SAMPLE;

  // A college can never place more students than it has left unplaced.
  const unplacedEligible = Math.max(0, eligibleStudentCount - placedStudentIds.length);
  const rawExpected = useStudentBasis
    ? inProgressStudents * studentPlacementRate
    : expectedFromApplicationRate([...pendingByStudent.values()], applicationSelectRate);

  const expectedAdditionalPlacements = confident ? Math.min(Math.round(rawExpected), unplacedEligible) : null;
  const projectedPlacedCount =
    expectedAdditionalPlacements !== null ? placedStudentIds.length + expectedAdditionalPlacements : null;
  const projectedPlacementPct =
    projectedPlacedCount !== null && eligibleStudentCount > 0
      ? Math.round((projectedPlacedCount / eligibleStudentCount) * 1000) / 10
      : null;

  return {
    confident,
    indicative,
    basis,
    /** The rate actually used for the projection, unrounded. */
    conversionRate,
    conversionRatePct: Math.round(conversionRate * 1000) / 10,
    sampleSize,
    sampleUnit: useStudentBasis ? ("students" as const) : ("applications" as const),
    /** Context only — never multiplied into the projection. */
    interviewPassRatePct: Math.round(interviewPassRate * 1000) / 10,
    interviewSampleSize: roundOutcomes,
    settledStudentCount: settledStudentIds.length,
    resolvedApplicationCount: resolvedApplications,
    /** Distinct unplaced students with live applications. */
    inProgressStudents,
    /** Raw application rows still running — always >= inProgressStudents. */
    inProgressApplications,
    currentPlacedCount: placedStudentIds.length,
    currentPlacementPct:
      eligibleStudentCount > 0 ? Math.round((placedStudentIds.length / eligibleStudentCount) * 1000) / 10 : 0,
    expectedAdditionalPlacements,
    projectedPlacedCount,
    projectedPlacementPct,
    eligibleStudentCount,
  };
}

// Department breakdown of the same projection. Takes the UNROUNDED rate and
// the basis from getPipelineForecast — the first version was handed
// selectRatePct / 100, so departments were computed from 0.905 while the
// college-wide figure used 0.90476, and the parts could disagree with the
// whole by a student.
//
// One college-wide rate is applied to every department on purpose:
// per-department samples are far too small in most colleges to support their
// own independent rate honestly.
export async function getDepartmentForecast(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts: { rate: number; basis: ForecastBasis; confident: boolean; batchId?: string | null },
) {
  const { rate, basis, confident, batchId = null } = opts;
  if (!confident) return [];

  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const placedStudentIds = (
    await db.offer.findMany({
      where: { status: { in: PLACING_OFFER_STATUSES }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    })
  ).map((o: { studentId: string }) => o.studentId);

  const rows = await db.application.findMany({
    where: { status: { in: IN_PROGRESS_STATUSES }, studentId: { notIn: placedStudentIds }, ...studentBatchWhere },
    select: { studentId: true, student: { select: { department: { select: { name: true } } } } },
  });

  // department -> studentId -> live application count
  const byDept = new Map<string, Map<string, number>>();
  for (const r of rows as { studentId: string; student: { department: { name: string } | null } }[]) {
    const key = r.student.department?.name ?? "Unassigned";
    const students = byDept.get(key) ?? new Map<string, number>();
    students.set(r.studentId, (students.get(r.studentId) ?? 0) + 1);
    byDept.set(key, students);
  }

  return [...byDept.entries()]
    .map(([name, students]) => {
      const expected =
        basis === "student" ? students.size * rate : expectedFromApplicationRate([...students.values()], rate);
      return { name, inProgressCount: students.size, expectedAdditional: Math.round(expected) };
    })
    .sort((a, b) => b.inProgressCount - a.inProgressCount);
}
