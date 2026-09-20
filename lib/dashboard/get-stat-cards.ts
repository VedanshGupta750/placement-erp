import { PLACED_OFFER_STATUSES } from "@/lib/students/placement";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOverviewStats(db: any, batchId: string | null = null) {
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const [
    totalStudents,
    eligibleStudents,
    activeDrives,
    closingSoon,
    totalApplications,
    pendingApproval,
    offersIssuedCount,
    offersAwaiting,
    offers,
  ] = await Promise.all([
    db.student.count({ where: batchId ? { batchId } : {} }),
    db.student.count({ where: { eligibleForPlacements: true, ...(batchId ? { batchId } : {}) } }),
    db.drive.count({ where: { status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SELECTION_ONGOING"] }, ...(batchId ? { batchId } : {}) } }),
    db.drive.count({
      where: {
        status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] },
        registrationClosesAt: { not: null, lte: in7Days },
        ...(batchId ? { batchId } : {}),
      },
    }),
    db.application.count({ where: studentBatchWhere }),
    db.application.count({ where: { status: "APPLIED", ...studentBatchWhere } }),
    db.offer.count({ where: { status: { not: "DRAFT" }, ...studentBatchWhere } }),
    db.offer.count({ where: { status: "ISSUED", ...studentBatchWhere } }),
    db.offer.findMany({ where: { status: { in: [...PLACED_OFFER_STATUSES] }, ...studentBatchWhere }, select: { studentId: true, totalCompensation: true } }),
  ]);

  const placedStudentIds = new Set(offers.map((o: { studentId: string }) => o.studentId));
  const placedCount = placedStudentIds.size;
  const packages = offers.map((o: { totalCompensation: unknown }) => Number(o.totalCompensation));
  const avgPackage = packages.length ? packages.reduce((a: number, b: number) => a + b, 0) / packages.length : 0;
  const sortedPackages = [...packages].sort((a, b) => a - b);
  const median = sortedPackages.length
    ? sortedPackages.length % 2 === 0
      ? (sortedPackages[sortedPackages.length / 2 - 1] + sortedPackages[sortedPackages.length / 2]) / 2
      : sortedPackages[Math.floor(sortedPackages.length / 2)]
    : 0;

  const placementRatePct = eligibleStudents > 0 ? (placedCount / eligibleStudents) * 100 : 0;
  const eligiblePct = totalStudents > 0 ? (eligibleStudents / totalStudents) * 100 : 0;
  const placedPctOfTotal = totalStudents > 0 ? (placedCount / totalStudents) * 100 : 0;

  return {
    totalStudents,
    eligibleStudents,
    eligiblePct: Math.round(eligiblePct * 10) / 10,
    activeDrives,
    closingSoon,
    totalApplications,
    pendingApproval,
    offersIssuedCount,
    offersAwaiting,
    placedCount,
    placedPctOfTotal: Math.round(placedPctOfTotal * 10) / 10,
    placementRatePct: Math.round(placementRatePct * 10) / 10,
    avgPackageLakh: Math.round((avgPackage / 100000) * 100) / 100,
    medianPackageLakh: Math.round((median / 100000) * 100) / 100,
  };
}
