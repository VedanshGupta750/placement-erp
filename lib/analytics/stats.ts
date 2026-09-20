// Real, computed numbers for the /analytics page — the "live analytics
// dashboard" half of what used to be crammed into /reports alongside
// formal exportable reports. Placement/package stats reuse the exact
// college/course/company breakdown logic already on /reports; this file
// adds the pieces that page never had: applications and interview funnel
// numbers, reusing the existing Applications/Interviews stat helpers
// rather than recomputing them a third way.
const PLACED_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"] as const;

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCollegeAnalytics(db: any, batchId: string | null = null) {
  const studentBatchWhere = batchId ? { batchId } : {};
  const studentRelBatchWhere = batchId ? { student: { batchId } } : {};

  const [studentCount, students, offers, drives, partnerships, applicationCount, interviewCount, passedInterviewCount] = await Promise.all([
    db.student.count({ where: studentBatchWhere }),
    db.student.findMany({ where: studentBatchWhere, select: { id: true, courseId: true, departmentId: true, course: { select: { name: true, specialization: true } }, department: { select: { name: true } } } }),
    db.offer.findMany({
      where: { status: { in: [...PLACED_OFFER_STATUSES] }, ...studentRelBatchWhere },
      select: { studentId: true, totalCompensation: true, driveId: true, drive: { select: { companyId: true, company: { select: { name: true } } } } },
    }),
    db.drive.findMany({ where: batchId ? { batchId } : {}, select: { id: true, companyId: true, status: true, company: { select: { name: true } } } }),
    // Partnerships are a company<->college relationship, not tied to one
    // batch — never batch-scoped.
    db.collegePartnership.count(),
    db.application.count({ where: studentRelBatchWhere }),
    db.roundCandidate.count({ where: studentRelBatchWhere }),
    db.roundCandidate.count({ where: { status: "PASSED", ...studentRelBatchWhere } }),
  ]);

  const placedStudentIds = new Set(offers.map((o: { studentId: string }) => o.studentId));
  const placedCount = placedStudentIds.size;
  const placementPct = studentCount > 0 ? (placedCount / studentCount) * 100 : 0;
  const packages = offers.map((o: { totalCompensation: unknown }) => Number(o.totalCompensation));
  const highest = packages.length ? Math.max(...packages) : 0;
  const average = packages.length ? packages.reduce((a: number, b: number) => a + b, 0) / packages.length : 0;
  const companiesWithOffers = new Set(offers.map((o: { drive: { companyId: string } }) => o.drive.companyId)).size;
  const interviewConversionPct = interviewCount > 0 ? (passedInterviewCount / interviewCount) * 100 : 0;

  const departmentMap = new Map<string, { name: string; total: number; placed: Set<string> }>();
  for (const s of students as { id: string; departmentId: string | null; department: { name: string } | null }[]) {
    const key = s.department?.name ?? "Unassigned";
    if (!departmentMap.has(key)) departmentMap.set(key, { name: key, total: 0, placed: new Set() });
    departmentMap.get(key)!.total += 1;
  }
  const studentDeptName = new Map(students.map((s: { id: string; department: { name: string } | null }) => [s.id, s.department?.name ?? "Unassigned"]));
  for (const o of offers as { studentId: string }[]) {
    const key = studentDeptName.get(o.studentId);
    if (key && departmentMap.has(key as string)) departmentMap.get(key as string)!.placed.add(o.studentId);
  }
  const departmentRows = [...departmentMap.values()]
    .map((r) => ({ name: r.name, total: r.total, placed: r.placed.size, pct: r.total > 0 ? (r.placed.size / r.total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const courseMap = new Map<string, { name: string; total: number; placed: Set<string>; offers: number; packages: number[] }>();
  for (const s of students as { id: string; course: { name: string; specialization: string | null } }[]) {
    const key = s.course.specialization ?? s.course.name;
    if (!courseMap.has(key)) courseMap.set(key, { name: key, total: 0, placed: new Set(), offers: 0, packages: [] });
    courseMap.get(key)!.total += 1;
  }
  const studentCourseName = new Map(students.map((s: { id: string; course: { name: string; specialization: string | null } }) => [s.id, s.course.specialization ?? s.course.name]));
  for (const o of offers as { studentId: string; totalCompensation: unknown }[]) {
    const key = studentCourseName.get(o.studentId);
    if (!key) continue;
    const row = courseMap.get(key as string)!;
    row.placed.add(o.studentId);
    row.offers += 1;
    row.packages.push(Number(o.totalCompensation));
  }
  const courseRows = [...courseMap.values()]
    .map((r) => ({ name: r.name, total: r.total, placed: r.placed.size, pct: r.total > 0 ? (r.placed.size / r.total) * 100 : 0, offers: r.offers, avgPackage: r.packages.length ? r.packages.reduce((a, b) => a + b, 0) / r.packages.length : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const companyMap = new Map<string, { name: string; drives: number; offers: number; placed: Set<string>; packages: number[] }>();
  for (const d of drives as { company: { name: string } }[]) {
    const key = d.company.name;
    if (!companyMap.has(key)) companyMap.set(key, { name: key, drives: 0, offers: 0, placed: new Set(), packages: [] });
    companyMap.get(key)!.drives += 1;
  }
  for (const o of offers as { studentId: string; totalCompensation: unknown; drive: { company: { name: string } } }[]) {
    const key = o.drive.company.name;
    if (!companyMap.has(key)) companyMap.set(key, { name: key, drives: 0, offers: 0, placed: new Set(), packages: [] });
    const row = companyMap.get(key)!;
    row.offers += 1;
    row.placed.add(o.studentId);
    row.packages.push(Number(o.totalCompensation));
  }
  const companyRows = [...companyMap.values()]
    .map((r) => ({ name: r.name, drives: r.drives, offers: r.offers, placed: r.placed.size, avgPackage: r.packages.length ? r.packages.reduce((a, b) => a + b, 0) / r.packages.length : 0 }))
    .sort((a, b) => b.offers - a.offers);

  return {
    studentCount, placedCount, placementPct, offerCount: offers.length, highest, average, median: median(packages),
    partnerships, companiesWithOffers, driveCount: drives.length,
    applicationCount, interviewCount, interviewConversionPct,
    departmentRows, courseRows, companyRows,
  };
}
