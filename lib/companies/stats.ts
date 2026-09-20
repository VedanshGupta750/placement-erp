// Real, computed numbers for the Companies list page and Company 360's
// Overview/Analytics tabs — nothing here is fabricated, every figure is a
// direct count/aggregate against the tenant-scoped Prisma client. Sibling
// to lib/contacts/stats.ts (which already covers per-company hiring
// activity/history — reused here, not duplicated).
import { ACTIVE_DRIVE_STATUSES } from "@/lib/contacts/stats";

const PLACED_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"];
const JOINED_STATUSES = ["JOINED"];

// `db` is intentionally untyped (`any`) — tenant-scoped client, same
// convention as lib/contacts/stats.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyListStats(db: any, batchId: string | null = null) {
  const driveBatchFilter = batchId ? { batchId } : {};
  const [totalPartnerships, activeHiring, totalDrives, offersGenerated, totalApplications] = await Promise.all([
    // Partnerships are a company<->college relationship, not tied to one
    // batch — never batch-scoped.
    db.collegePartnership.count(),
    db.collegePartnership.count({ where: { status: { in: ["ACTIVE", "PARTNER"] }, company: { drives: { some: { status: { in: ACTIVE_DRIVE_STATUSES }, ...driveBatchFilter } } } } }),
    db.drive.count({ where: driveBatchFilter }),
    db.offer.count({ where: { status: { in: PLACED_OFFER_STATUSES }, ...(batchId ? { student: { batchId } } : {}) } }),
    db.application.count({ where: batchId ? { student: { batchId } } : {} }),
  ]);

  const placementConversion = totalApplications > 0 ? Math.round((offersGenerated / totalApplications) * 1000) / 10 : 0;

  return { totalPartnerships, activeHiring, totalDrives, offersGenerated, placementConversion };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyFunnel(db: any, companyId: string) {
  const [applications, shortlisted, interviewed, selected, offers, joined] = await Promise.all([
    db.application.count({ where: { drive: { companyId } } }),
    db.application.count({ where: { drive: { companyId }, status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] } } }),
    db.roundCandidate.count({ where: { application: { drive: { companyId } } } }),
    db.application.count({ where: { drive: { companyId }, status: "SELECTED" } }),
    db.offer.count({ where: { drive: { companyId } } }),
    db.offer.count({ where: { drive: { companyId }, status: { in: JOINED_STATUSES } } }),
  ]);

  const offerRate = applications > 0 ? Math.round((offers / applications) * 1000) / 10 : 0;
  const joiningRate = offers > 0 ? Math.round((joined / offers) * 1000) / 10 : 0;

  return { applications, shortlisted, interviewed, selected, offers, joined, offerRate, joiningRate };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyPackageAnalytics(db: any, companyId: string, batchId: string | null = null) {
  const offers = await db.offer.findMany({
    where: { drive: { companyId, ...(batchId ? { batchId } : {}) }, status: { in: PLACED_OFFER_STATUSES } },
    select: { totalCompensation: true, offerType: true },
  });

  const values = offers
    .map((o: { totalCompensation: unknown }) => (o.totalCompensation != null ? Number(o.totalCompensation) : NaN))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .sort((a: number, b: number) => a - b);

  if (values.length === 0) {
    return { count: 0, minCtc: null, maxCtc: null, avgCtc: null, medianCtc: null };
  }

  const sum = values.reduce((s: number, v: number) => s + v, 0);
  const mid = Math.floor(values.length / 2);
  const medianCtc = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

  return {
    count: values.length,
    minCtc: values[0],
    maxCtc: values[values.length - 1],
    avgCtc: Math.round((sum / values.length) * 100) / 100,
    medianCtc: Math.round(medianCtc * 100) / 100,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyDepartmentBreakdown(db: any, companyId: string) {
  const offers = await db.offer.findMany({
    where: { drive: { companyId }, status: { in: PLACED_OFFER_STATUSES } },
    select: { student: { select: { department: { select: { name: true } } } } },
  });
  const counts = new Map<string, number>();
  for (const o of offers as { student: { department: { name: string } | null } }[]) {
    const label = o.student.department?.name ?? "Unassigned";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// Cheap preview count for the "Hiring Preference" panel — deliberately not
// the full DriveEligibilityRule AND/OR/NOT engine (that's built to design
// one drive's rule; a company-level "preference" is a much looser signal
// used only to prefill and estimate, not to gate anything).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyEligiblePreviewCount(db: any, company: { preferredCourseIds: string[]; minCgpaPreference: unknown; backlogPolicy: string | null }) {
  const where: Record<string, unknown> = { hasPlacementAccess: true };
  if (company.preferredCourseIds.length > 0) where.courseId = { in: company.preferredCourseIds };
  if (company.minCgpaPreference != null) where.aggregate = { gte: Number(company.minCgpaPreference) };
  if (company.backlogPolicy === "NO_ACTIVE_BACKLOGS") where.liveBacklogs = 0;
  return db.student.count({ where });
}

// Earliest upcoming/overdue follow-up across all of a company's recruiter
// contacts — the company-level rollup of Contact.nextFollowUpAt rather than
// a duplicated field on Company itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyNextFollowUp(db: any, companyId: string) {
  const contact = await db.contact.findFirst({
    where: { companyId, nextFollowUpAt: { not: null } },
    orderBy: { nextFollowUpAt: "asc" },
    select: { id: true, name: true, nextFollowUpAt: true, nextFollowUpNote: true },
  });
  return contact ?? null;
}

// Plain helper (not a component) so `Date.now()` doesn't trip the
// "impure function during render" rule the way calling it directly inside
// a page component body would.
export function computeDormantAlertCount(
  partnerships: { status: string; company: { drives: { createdAt: Date }[] } }[],
  thresholdMonths: number,
): number {
  const now = Date.now();
  return partnerships.filter((p) => {
    const lastDriveAt = p.company.drives.reduce<Date | null>((latest, d) => (!latest || d.createdAt > latest ? d.createdAt : latest), null);
    if (!lastDriveAt) return p.status !== "PENDING";
    const monthsSince = (now - lastDriveAt.getTime()) / (30 * 86_400_000);
    return monthsSince >= thresholdMonths;
  }).length;
}

// Most recent real activity across communications/drives/events — feeds
// both the list card's "Last activity" and the health score's recency
// signal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyLastActivityAt(db: any, companyId: string): Promise<Date | null> {
  const [lastComm, lastDrive, lastEvent] = await Promise.all([
    db.contactCommunication.findFirst({ where: { contact: { companyId } }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
    db.drive.findFirst({ where: { companyId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.event.findFirst({ where: { companyId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const dates = [lastComm?.occurredAt, lastDrive?.updatedAt, lastEvent?.updatedAt].filter(Boolean) as Date[];
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
}
