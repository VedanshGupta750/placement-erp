// Real, computed numbers for the Offers list page — sibling to
// lib/applications/stats.ts / lib/companies/stats.ts.
const PLACED_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOfferListStats(db: any, where: Record<string, unknown> = {}) {
  const [total, issued, accepted, declined, joined, placedOffers] = await Promise.all([
    db.offer.count({ where }),
    db.offer.count({ where: { ...where, status: "ISSUED" } }),
    db.offer.count({ where: { ...where, status: "ACCEPTED" } }),
    db.offer.count({ where: { ...where, status: "DECLINED" } }),
    db.offer.count({ where: { ...where, status: "JOINED" } }),
    db.offer.findMany({ where: { ...where, status: { in: PLACED_STATUSES } }, select: { totalCompensation: true } }),
  ]);

  const values = placedOffers
    .map((o: { totalCompensation: unknown }) => Number(o.totalCompensation))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  const avgPackage = values.length > 0 ? Math.round((values.reduce((s: number, v: number) => s + v, 0) / values.length) * 100) / 100 : null;

  return { total, issued, accepted, declined, joined, avgPackage };
}

// Selected applications -> Offer created -> Issued -> Accepted -> Joined —
// every stage a real count against the same `where` scope.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOfferFunnel(db: any, where: Record<string, unknown> = {}) {
  const driveWhere = (where.drive as Record<string, unknown> | undefined) ?? undefined;
  const studentWhere = (where.student as Record<string, unknown> | undefined) ?? undefined;
  const [selected, created, issued, accepted, joined] = await Promise.all([
    db.application.count({
      where: {
        status: { in: ["SELECTED", "ROUND_IN_PROGRESS"] },
        ...(driveWhere ? { drive: driveWhere } : {}),
        ...(studentWhere ? { student: studentWhere } : {}),
      },
    }),
    db.offer.count({ where }),
    db.offer.count({ where: { ...where, status: { not: "DRAFT" } } }),
    db.offer.count({ where: { ...where, status: { in: PLACED_STATUSES } } }),
    db.offer.count({ where: { ...where, status: "JOINED" } }),
  ]);

  function rate(n: number, d: number) {
    return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
  }

  return {
    stages: [
      { label: "Selected", count: selected },
      { label: "Offered", count: created, conversionFromPrev: rate(created, selected) },
      { label: "Issued", count: issued, conversionFromPrev: rate(issued, created) },
      { label: "Accepted", count: accepted, conversionFromPrev: rate(accepted, issued) },
      { label: "Joined", count: joined, conversionFromPrev: rate(joined, accepted) },
    ],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOfferDepartmentBreakdown(db: any, where: Record<string, unknown> = {}, limit = 6) {
  const offers = await db.offer.findMany({
    where: { ...where, status: { in: PLACED_STATUSES } },
    select: { student: { select: { department: { select: { name: true } } } } },
  });
  const counts = new Map<string, number>();
  for (const o of offers as { student: { department: { name: string } | null } }[]) {
    const label = o.student.department?.name ?? "Unassigned";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
