// Real, derived placement status for a student in the Network directory —
// same 4 states the rest of the app already uses (Student.placementStatus,
// Offer, Application), just batched for a list of students instead of one.
// No new field, no fake "online" style status invented alongside it.
import { PLACED_OFFER_STATUSES } from "@/lib/students/placement";

const PLACED_STATUSES = [...PLACED_OFFER_STATUSES];
const ACTIVE_APPLICATION_STATUSES = ["APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS"];

export type NetworkPlacementStatus =
  | { kind: "placed"; companyName: string; package: string }
  | { kind: "in_process"; activeCount: number }
  | { kind: "not_eligible" }
  | { kind: "eligible" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlacementStatusByStudentId(db: any, studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, NetworkPlacementStatus>();

  const [offers, activeCounts, students] = await Promise.all([
    db.offer.findMany({
      where: { studentId: { in: studentIds }, status: { in: PLACED_STATUSES } },
      select: { studentId: true, totalCompensation: true, drive: { select: { company: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.application.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, status: { in: ACTIVE_APPLICATION_STATUSES } },
      _count: { _all: true },
    }),
    db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, eligibleForPlacements: true, hasPlacementAccess: true },
    }),
  ]);

  const offerByStudent = new Map<string, { totalCompensation: unknown; drive: { company: { name: string } } }>();
  for (const o of offers as { studentId: string; totalCompensation: unknown; drive: { company: { name: string } } }[]) {
    if (!offerByStudent.has(o.studentId)) offerByStudent.set(o.studentId, o);
  }
  const activeByStudent = new Map<string, number>(activeCounts.map((a: { studentId: string; _count: { _all: number } }) => [a.studentId, a._count._all]));
  const eligibility = new Map(students.map((s: { id: string; eligibleForPlacements: boolean; hasPlacementAccess: boolean }) => [s.id, s]));

  const result = new Map<string, NetworkPlacementStatus>();
  for (const id of studentIds) {
    const offer = offerByStudent.get(id);
    if (offer) {
      result.set(id, { kind: "placed", companyName: offer.drive.company.name, package: `₹${(Number(offer.totalCompensation) / 100000).toFixed(1)}L` });
      continue;
    }
    const activeCount = activeByStudent.get(id) ?? 0;
    if (activeCount > 0) {
      result.set(id, { kind: "in_process", activeCount });
      continue;
    }
    const elig = eligibility.get(id) as { eligibleForPlacements: boolean; hasPlacementAccess: boolean } | undefined;
    if (elig && (!elig.eligibleForPlacements || !elig.hasPlacementAccess)) {
      result.set(id, { kind: "not_eligible" });
      continue;
    }
    result.set(id, { kind: "eligible" });
  }
  return result;
}
