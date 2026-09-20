// No "server-only" guard — kept usable the same way lib/dashboard/get-action-items.ts
// and lib/applications.ts are. Computes the six-stage placement funnel shown
// on the TPO dashboard overview: Eligible -> Applied -> Shortlisted ->
// Interviewed -> Offers -> Joined, each a real count derived from the
// tenant-scoped Prisma client (no fabricated numbers).

export type FunnelStage = { label: string; value: number; pctOfPrevious: number | null };

function pctOf(value: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round((value / previous) * 100);
}

// `db` is intentionally untyped (`any`) — this function is called with the
// tenant-scoped client, and unifying the tenant-scoped/raw/transaction
// Prisma client types blows up TypeScript's comparison stack in this
// codebase, the same issue documented in lib/applications.ts and
// lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFunnelData(db: any, collegeId: string, batchId: string | null = null): Promise<FunnelStage[]> {
  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const [
    eligibleCount,
    appliedStudents,
    shortlistedHistoryRows,
    shortlistedStatusApplications,
    allRoundCandidates,
    interviewedCandidates,
    offeredStudents,
    joinedCount,
  ] = await Promise.all([
    // 1. Eligible Students.
    db.student.count({ where: { eligibleForPlacements: true, ...(batchId ? { batchId } : {}) } }),
    // 2. Applied — distinct students with at least one Application.
    db.application.findMany({ where: studentBatchWhere, select: { studentId: true }, distinct: ["studentId"] }),
    // 3a. Shortlisted, via the audit trail — students whose application
    // history ever transitioned into SHORTLISTED/ROUND_IN_PROGRESS/SELECTED.
    // This is the precise signal, but only exists for applications that went
    // through transitionApplication() (i.e. real app usage, not bulk-seeded
    // demo data — prisma/seed.ts writes applications straight to their final
    // status without an audit trail, so this alone under-counts on a fresh
    // seed). Combined with the two fallbacks below via a union of studentIds.
    db.applicationStatusHistory.findMany({
      where: { toStatus: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] }, ...(batchId ? { application: { student: { batchId } } } : {}) },
      select: { application: { select: { studentId: true } } },
    }),
    // 3b. Fallback — students whose application is CURRENTLY at or past
    // Shortlisted in the pipeline (catches seeded data with no history rows).
    db.application.findMany({
      where: { status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    // 3c. Fallback — being assigned to ANY interview round (regardless of
    // that round's current status) necessarily means the application was
    // shortlisted first, even if no audit row or current-status match exists.
    db.roundCandidate.findMany({ where: studentBatchWhere, select: { studentId: true }, distinct: ["studentId"] }),
    // 4. Interviewed — distinct students with a RoundCandidate whose status
    // shows the interview actually happened (not just assigned/scheduled).
    db.roundCandidate.findMany({
      where: { status: { in: ["IN_PROGRESS", "PASSED", "FAILED", "NO_SHOW"] }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    // 5. Offers — distinct students with an Offer that has actually been
    // issued or further (i.e. not still a DRAFT).
    db.offer.findMany({
      where: { status: { not: "DRAFT" }, ...studentBatchWhere },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    // 6. Joined.
    db.offer.count({ where: { status: "JOINED", ...studentBatchWhere } }),
  ]);

  const appliedCount = appliedStudents.length;
  const shortlistedSet = new Set<string>();
  for (const row of shortlistedHistoryRows as { application: { studentId: string } }[]) {
    shortlistedSet.add(row.application.studentId);
  }
  for (const row of shortlistedStatusApplications as { studentId: string }[]) {
    shortlistedSet.add(row.studentId);
  }
  for (const row of allRoundCandidates as { studentId: string }[]) {
    shortlistedSet.add(row.studentId);
  }
  const shortlistedCount = shortlistedSet.size;
  const interviewedCount = interviewedCandidates.length;
  const offersCount = offeredStudents.length;

  const stages: FunnelStage[] = [];
  stages.push({ label: "Eligible Students", value: eligibleCount, pctOfPrevious: null });
  stages.push({ label: "Applied", value: appliedCount, pctOfPrevious: pctOf(appliedCount, eligibleCount) });
  stages.push({ label: "Shortlisted", value: shortlistedCount, pctOfPrevious: pctOf(shortlistedCount, appliedCount) });
  stages.push({ label: "Interviewed", value: interviewedCount, pctOfPrevious: pctOf(interviewedCount, shortlistedCount) });
  stages.push({ label: "Offers", value: offersCount, pctOfPrevious: pctOf(offersCount, interviewedCount) });
  stages.push({ label: "Joined", value: joinedCount, pctOfPrevious: pctOf(joinedCount, offersCount) });

  return stages;
}
