// Real, computed summary numbers for the Contacts list page's header cards
// and a per-company hiring-activity aggregator reused by the Contact 360
// and Company detail pages. Nothing here is fabricated — every number is a
// direct count/aggregate against the tenant-scoped Prisma client.

import { RELATIONSHIP_STAGES, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

export const ACTIVE_DRIVE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SELECTION_ONGOING"] as const;
const PLACED_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"];

// `db` is intentionally untyped (`any`) — tenant-scoped client, see the
// documented convention in lib/applications.ts / lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getContactListStats(db: any) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [totalContacts, activeContacts, followUpsDueToday, companiesCovered] = await Promise.all([
    db.contact.count(),
    db.contact.count({ where: { isActive: true } }),
    db.contact.count({ where: { nextFollowUpAt: { lte: endOfDay } } }),
    db.contact.findMany({ where: { companyId: { not: null } }, select: { companyId: true }, distinct: ["companyId"] }).then((r: unknown[]) => r.length),
  ]);

  return { totalContacts, activeContacts, followUpsDueToday, companiesCovered };
}

// Real distribution of contacts across the fixed 7-stage relationship
// pipeline, in pipeline order (not sorted by count) — feeds the funnel
// visualization on the Contacts list page.
// `db` is intentionally untyped (`any`) — see above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRelationshipStageBreakdown(db: any) {
  const grouped = await db.contact.groupBy({ by: ["relationshipStage"], _count: { _all: true } });
  const countByStage = new Map<string, number>(
    grouped.map((g: { relationshipStage: string; _count: { _all: number } }) => [g.relationshipStage, g._count._all]),
  );
  return RELATIONSHIP_STAGES.map((stage) => ({
    stage,
    label: RELATIONSHIP_STAGE_LABELS[stage],
    count: countByStage.get(stage) ?? 0,
  }));
}

// `db` is intentionally untyped (`any`) — see above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyHiringActivity(db: any, companyId: string) {
  const [activeDrives, completedDrives, offers] = await Promise.all([
    db.drive.count({ where: { companyId, status: { in: ACTIVE_DRIVE_STATUSES } } }),
    db.drive.count({ where: { companyId, status: "COMPLETED" } }),
    db.offer.findMany({
      where: { drive: { companyId }, status: { in: PLACED_OFFER_STATUSES } },
      select: { studentId: true, createdAt: true },
    }),
  ]);

  const studentsHired = new Set(offers.map((o: { studentId: string }) => o.studentId)).size;
  const offersMade = offers.length;

  const byYear = new Map<number, Set<string>>();
  for (const o of offers as { studentId: string; createdAt: Date }[]) {
    const year = new Date(o.createdAt).getFullYear();
    if (!byYear.has(year)) byYear.set(year, new Set());
    byYear.get(year)!.add(o.studentId);
  }
  const hiringHistory = [...byYear.entries()]
    .map(([year, students]) => ({ year, studentsHired: students.size }))
    .sort((a, b) => a.year - b.year);

  return { activeDrives, completedDrives, studentsHired, offersMade, hiringHistory };
}
