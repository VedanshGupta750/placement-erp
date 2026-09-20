import "server-only";
import { getTenantDb } from "@/lib/tenant/scoped-db";

const PLACED_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"] as const;

// A compact, already-aggregated snapshot of this college's placement numbers
// — handed to the AI as context for the TPO copilot. Deliberately
// summary-level (counts, percentages, top-N lists) rather than raw student
// rows, so a chat feature never becomes a way to exfiltrate the full
// candidate roster through a prompt.
export async function buildPlacementContext(collegeId: string): Promise<string> {
  const db = getTenantDb(collegeId);

  const [studentCount, students, offers, drives, applications, pendingApprovals] = await Promise.all([
    db.student.count(),
    db.student.findMany({ select: { id: true, course: { select: { name: true, specialization: true } } } }),
    db.offer.findMany({
      select: { studentId: true, status: true, totalCompensation: true, drive: { select: { title: true, company: { select: { name: true } } } } },
    }),
    db.drive.findMany({ select: { id: true, title: true, status: true, company: { select: { name: true } } } }),
    db.application.findMany({ select: { status: true } }),
    db.drive.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);

  const placedOffers = offers.filter((o) => (PLACED_OFFER_STATUSES as readonly string[]).includes(o.status));
  const placedStudentIds = new Set(placedOffers.map((o) => o.studentId));
  const placementPct = studentCount > 0 ? Math.round((placedStudentIds.size / studentCount) * 100) : 0;
  const packages = placedOffers.map((o) => Number(o.totalCompensation));
  const highest = packages.length ? Math.max(...packages) : 0;
  const average = packages.length ? Math.round(packages.reduce((a, b) => a + b, 0) / packages.length) : 0;

  const companyOfferCounts = new Map<string, number>();
  for (const o of placedOffers) {
    const name = o.drive.company.name;
    companyOfferCounts.set(name, (companyOfferCounts.get(name) ?? 0) + 1);
  }
  const topCompanies = [...companyOfferCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const courseCounts = new Map<string, number>();
  for (const s of students) {
    const key = s.course.specialization ?? s.course.name;
    courseCounts.set(key, (courseCounts.get(key) ?? 0) + 1);
  }

  const driveStatusCounts = new Map<string, number>();
  for (const d of drives) driveStatusCounts.set(d.status, (driveStatusCounts.get(d.status) ?? 0) + 1);

  const applicationStatusCounts = new Map<string, number>();
  for (const a of applications) applicationStatusCounts.set(a.status, (applicationStatusCounts.get(a.status) ?? 0) + 1);

  return [
    `Total students: ${studentCount}`,
    `Students placed: ${placedStudentIds.size} (${placementPct}%)`,
    `Total offers issued/accepted: ${offers.length}, currently placed-status offers: ${placedOffers.length}`,
    `Average package (placed offers): ₹${average.toLocaleString("en-IN")}`,
    `Highest package: ₹${highest.toLocaleString("en-IN")}`,
    `Top recruiting companies by offer count: ${topCompanies.map(([n, c]) => `${n} (${c})`).join(", ") || "none yet"}`,
    `Students by course: ${[...courseCounts.entries()].map(([n, c]) => `${n}: ${c}`).join(", ") || "none"}`,
    `Drives by status: ${[...driveStatusCounts.entries()].map(([s, c]) => `${s}: ${c}`).join(", ") || "none"}`,
    `Applications by status: ${[...applicationStatusCounts.entries()].map(([s, c]) => `${s}: ${c}`).join(", ") || "none"}`,
    `Drives pending approval right now: ${pendingApprovals}`,
  ].join("\n");
}
