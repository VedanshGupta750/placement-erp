// "Alumni" isn't a separate tracked entity in this schema — there's no
// post-graduation employer/location tracking beyond what Placement already
// recorded. Rather than invent alumni profile data that doesn't exist,
// this surfaces exactly what's real: students from a batch whose year has
// already passed, who have a real JOINED offer on record. A student who
// graduated but never joined anywhere (or whose batch data is incomplete)
// honestly doesn't show up here — that's correct, not a bug.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAlumni(db: any, where: Record<string, unknown> = {}, currentYear: number) {
  const offers = await db.offer.findMany({
    where: {
      status: "JOINED",
      student: { batch: { year: { lt: currentYear } }, ...where },
    },
    select: {
      id: true,
      totalCompensation: true,
      studentId: true,
      student: {
        select: {
          id: true,
          user: { select: { name: true, email: true, avatarUrl: true } },
          course: { select: { name: true, specialization: true } },
          batch: { select: { year: true } },
        },
      },
      drive: { select: { company: { select: { name: true } }, positions: { select: { title: true }, take: 1 } } },
      position: { select: { title: true } },
    },
    orderBy: { student: { batch: { year: "desc" } } },
    take: 200,
  });

  return offers.map((o: {
    id: string; totalCompensation: unknown; studentId: string;
    student: { id: string; user: { name: string; email: string; avatarUrl: string | null }; course: { name: string; specialization: string | null }; batch: { year: number } };
    drive: { company: { name: string } };
    position: { title: string } | null;
  }) => ({
    studentId: o.studentId,
    name: o.student.user.name,
    email: o.student.user.email,
    avatarUrl: o.student.user.avatarUrl,
    courseLabel: o.student.course.specialization ?? o.student.course.name,
    batchYear: o.student.batch.year,
    companyName: o.drive.company.name,
    positionTitle: o.position?.title ?? null,
    package: `₹${(Number(o.totalCompensation) / 100000).toFixed(1)}L`,
  }));
}
