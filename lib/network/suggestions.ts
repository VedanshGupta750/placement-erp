// "People you may know" — real signals only: same course+batch, or having
// applied to at least one of the same drives. No invented "3 common
// groups" style claims for connections that don't actually share anything
// real (this app has no group-membership model — see lib/network/groups.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSuggestedConnections(db: any, forUserId: string, limit = 5) {
  const student = await db.student.findUnique({ where: { userId: forUserId }, select: { id: true, courseId: true, batchId: true } });
  if (!student) return [];

  const myDriveIds = (
    await db.application.findMany({ where: { studentId: student.id }, select: { driveId: true } })
  ).map((a: { driveId: string }) => a.driveId);

  const [sameCohort, sameDriveApplicants] = await Promise.all([
    db.student.findMany({
      where: { courseId: student.courseId, batchId: student.batchId, id: { not: student.id } },
      include: { user: { select: { id: true, name: true } }, course: true },
      take: limit,
    }),
    myDriveIds.length > 0
      ? db.application.findMany({
          where: { driveId: { in: myDriveIds }, studentId: { not: student.id } },
          select: { studentId: true, driveId: true, student: { select: { user: { select: { id: true, name: true } }, course: true } } },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const driveOverlapCount = new Map<string, { count: number; user: { id: string; name: string }; courseLabel: string }>();
  for (const a of sameDriveApplicants as { studentId: string; student: { user: { id: string; name: string }; course: { name: string; specialization: string | null } } }[]) {
    const entry = driveOverlapCount.get(a.studentId) ?? { count: 0, user: a.student.user, courseLabel: a.student.course.specialization ?? a.student.course.name };
    entry.count += 1;
    driveOverlapCount.set(a.studentId, entry);
  }

  const suggestions = new Map<string, { userId: string; name: string; courseLabel: string; reason: string }>();
  for (const s of sameCohort as { userId: string; user: { id: string; name: string }; course: { name: string; specialization: string | null } }[]) {
    suggestions.set(s.user.id, { userId: s.user.id, name: s.user.name, courseLabel: s.course.specialization ?? s.course.name, reason: "Same batch & course" });
  }
  for (const [, v] of driveOverlapCount) {
    if (suggestions.has(v.user.id)) continue;
    suggestions.set(v.user.id, { userId: v.user.id, name: v.user.name, courseLabel: v.courseLabel, reason: `Applied to ${v.count} of the same drive${v.count === 1 ? "" : "s"}` });
  }

  return [...suggestions.values()].slice(0, limit);
}
