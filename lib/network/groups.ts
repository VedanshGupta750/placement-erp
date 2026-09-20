// "Groups" in the Network module aren't a separate membership model — no
// group-join/leave workflow exists anywhere in this schema, and building
// one just to have something to put under a "Groups" tab would be
// decorative. Instead, every group here is a real, already-meaningful
// cohort computed live from existing relations: batch×course, department,
// and active-drive applicant lists. This is honest ("no fake dashboards")
// and happens to match exactly what the mockup's example groups actually
// are (e.g. "CSE 2026 Batch", "Siemens Drive 2026").
export type NetworkGroup = { id: string; label: string; sublabel: string; count: number; href: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBatchCourseGroups(db: any, limit = 10): Promise<NetworkGroup[]> {
  const grouped = await db.student.groupBy({
    by: ["batchId", "courseId"],
    _count: { _all: true },
    orderBy: { _count: { batchId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const [batches, courses] = await Promise.all([
    db.batch.findMany({ where: { id: { in: grouped.map((g: { batchId: string }) => g.batchId) } }, select: { id: true, year: true } }),
    db.course.findMany({ where: { id: { in: grouped.map((g: { courseId: string }) => g.courseId) } }, select: { id: true, name: true, specialization: true } }),
  ]);
  const batchById = new Map(batches.map((b: { id: string; year: number }) => [b.id, b.year]));
  const courseById = new Map(courses.map((c: { id: string; name: string; specialization: string | null }) => [c.id, c]));

  return grouped
    .map((g: { batchId: string; courseId: string; _count: { _all: number } }) => {
      const year = batchById.get(g.batchId);
      const course = courseById.get(g.courseId) as { name: string; specialization: string | null } | undefined;
      const label = course ? `${course.specialization ?? course.name} ${year}` : `Batch ${year}`;
      return {
        id: `${g.batchId}:${g.courseId}`,
        label,
        sublabel: "Batch",
        count: g._count._all,
        href: `/network?courseId=${g.courseId}&batchId=${g.batchId}`,
      };
    })
    .sort((a: NetworkGroup, b: NetworkGroup) => b.count - a.count);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDriveGroups(db: any, limit = 10): Promise<NetworkGroup[]> {
  const drives = await db.drive.findMany({
    where: { status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "SELECTION_ONGOING"] } },
    select: { id: true, title: true, company: { select: { name: true } }, _count: { select: { applications: true } } },
    orderBy: { applications: { _count: "desc" } },
    take: limit,
  });
  return drives
    .filter((d: { _count: { applications: number } }) => d._count.applications > 0)
    .map((d: { id: string; title: string; company: { name: string }; _count: { applications: number } }) => ({
      id: d.id,
      label: `${d.company.name} — ${d.title}`,
      sublabel: "Drive applicants",
      count: d._count.applications,
      href: `/applications?driveId=${d.id}`,
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDepartmentGroups(db: any, limit = 10): Promise<NetworkGroup[]> {
  const departments = await db.department.findMany({
    select: { id: true, name: true, _count: { select: { memberships: true } } },
    orderBy: { name: "asc" },
    take: limit,
  });
  const studentCounts = await Promise.all(
    departments.map((d: { id: string }) => db.student.count({ where: { departmentId: d.id } })),
  );
  return departments.map((d: { id: string; name: string; _count: { memberships: number } }, i: number) => ({
    id: d.id,
    label: d.name,
    sublabel: `${d._count.memberships} staff`,
    count: studentCounts[i] + d._count.memberships,
    href: `/network?departmentId=${d.id}`,
  }));
}
