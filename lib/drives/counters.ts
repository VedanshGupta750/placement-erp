// No "server-only" guard — shared with prisma/seed.ts, which runs as a
// plain Node script outside Next.js's bundler.

// A minimal structural type instead of TenantDb | TenantTx | PrismaClient —
// that union is deep enough (tenant-scoping is a $extends query hook) that
// TypeScript blows its comparison stack trying to unify the three
// `drive.update` overloads. Every caller (raw prisma, tenant-scoped db,
// $transaction tx) satisfies this shape structurally, so nothing is lost.
type CounterDb = {
  eligibilityResult: { count: (args: { where: { snapshot: { driveId: string }; eligible: true } }) => Promise<number> };
  application: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: (args: { where: { driveId: string; status?: { in: any[] } } }) => Promise<number>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offer: { count: (args: { where: { driveId: string; status: { not: any } } }) => Promise<number> };
  drive: {
    update: (args: {
      where: { id: string };
      data: { eligibleCount: number; appliedCount: number; approvedCount: number; shortlistedCount: number; offerCount: number };
    }) => Promise<unknown>;
  };
};

// Recomputes and persists a drive's denormalised funnel counters
// (eligible/applied/approved/shortlisted/offer) from the transactional
// facts. Called after any write that could move the funnel — cheaper than a
// live aggregate on every dashboard/report render once a college has
// hundreds of drives (see prisma/schema.prisma Drive model comment).
export async function recomputeDriveCounters(db: CounterDb, driveId: string) {
  const [eligibleCount, appliedCount, approvedCount, shortlistedCount, offerCount] = await Promise.all([
    db.eligibilityResult.count({ where: { snapshot: { driveId }, eligible: true } }),
    db.application.count({ where: { driveId } }),
    db.application.count({ where: { driveId, status: { in: ["COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] } } }),
    db.application.count({ where: { driveId, status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] } } }),
    db.offer.count({ where: { driveId, status: { not: "WITHDRAWN" } } }),
  ]);

  await db.drive.update({
    where: { id: driveId },
    data: { eligibleCount, appliedCount, approvedCount, shortlistedCount, offerCount },
  });
}
