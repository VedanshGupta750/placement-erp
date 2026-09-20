// Real, computed numbers for the Applications list page — nothing here is
// fabricated, every figure is a direct count/aggregate against the
// tenant-scoped Prisma client. Sibling to lib/companies/stats.ts /
// lib/contacts/stats.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getApplicationListStats(db: any, where: Record<string, unknown> = {}) {
  const [total, uniqueStudentIds, shortlisted, selected, inProgress, withOffer] = await Promise.all([
    db.application.count({ where }),
    db.application.findMany({ where, select: { studentId: true }, distinct: ["studentId"] }),
    db.application.count({ where: { ...where, status: "SHORTLISTED" } }),
    db.application.count({ where: { ...where, status: "SELECTED" } }),
    db.application.count({ where: { ...where, status: "ROUND_IN_PROGRESS" } }),
    db.application.count({ where: { ...where, offer: { isNot: null } } }),
  ]);

  return {
    total,
    uniqueStudents: uniqueStudentIds.length,
    shortlisted,
    selected,
    inProgress,
    withOffer,
  };
}

// Top N drives by application count, for the list page's "Drive-wise
// Applications" sidebar widget.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDriveWiseApplicationCounts(db: any, where: Record<string, unknown> = {}, limit = 5) {
  const grouped = await db.application.groupBy({
    where,
    by: ["driveId"],
    _count: { _all: true },
    orderBy: { _count: { driveId: "desc" } },
    take: limit,
  });

  const drives = await db.drive.findMany({
    where: { id: { in: grouped.map((g: { driveId: string }) => g.driveId) } },
    select: { id: true, title: true, company: { select: { name: true } } },
  });
  const driveById = new Map(drives.map((d: { id: string; title: string; company: { name: string } }) => [d.id, d]));

  const totalCount = grouped.reduce((s: number, g: { _count: { _all: number } }) => s + g._count._all, 0);

  return {
    rows: grouped.map((g: { driveId: string; _count: { _all: number } }) => {
      const drive = driveById.get(g.driveId) as { title: string; company: { name: string } } | undefined;
      return {
        driveId: g.driveId,
        label: drive ? `${drive.company.name} — ${drive.title}` : "Unknown drive",
        count: g._count._all,
      };
    }),
    totalCount,
  };
}

// Application -> Shortlist -> Interview -> Selected -> Offer -> Joined
// conversion funnel — every stage is a real count, never estimated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getApplicationFunnel(db: any, where: Record<string, unknown> = {}) {
  const [applied, shortlisted, interviewed, selected, offers, joined] = await Promise.all([
    db.application.count({ where }),
    db.application.count({ where: { ...where, status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] } } }),
    db.roundCandidate.count({ where: { application: where } }),
    db.application.count({ where: { ...where, status: "SELECTED" } }),
    db.offer.count({ where: { application: where } }),
    db.offer.count({ where: { application: where, status: "JOINED" } }),
  ]);

  function rate(numerator: number, denominator: number) {
    return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
  }

  return {
    stages: [
      { label: "Applied", count: applied },
      { label: "Shortlisted", count: shortlisted, conversionFromPrev: rate(shortlisted, applied) },
      { label: "Interviewed", count: interviewed, conversionFromPrev: rate(interviewed, shortlisted) },
      { label: "Selected", count: selected, conversionFromPrev: rate(selected, interviewed) },
      { label: "Offers", count: offers, conversionFromPrev: rate(offers, selected) },
      { label: "Joined", count: joined, conversionFromPrev: rate(joined, offers) },
    ],
  };
}
