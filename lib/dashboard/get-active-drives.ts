// No "server-only" guard — kept usable the same way lib/dashboard/get-funnel-data.ts
// and lib/applications.ts are. Surfaces the drives currently in flight (not
// draft/archived/cancelled/rejected) for the "Active Drives" table on the
// TPO dashboard overview.

export type ActiveDrive = {
  id: string;
  title: string;
  company: string;
  eligible: number;
  applied: number;
  appliedPct: number; // 0-100, applied/eligible, rounded, 0 if eligible is 0
  status: string; // raw DriveStatus value — StatusBadge already knows how to render this
  href: string;
};

// Drives in these statuses are no longer "active" — never actually
// launched (DRAFT), or terminated one way or another.
const INACTIVE_STATUSES = ["DRAFT", "ARCHIVED", "CANCELLED", "REJECTED"];

// `db` is intentionally untyped (`any`) — this function is called with the
// tenant-scoped client, and unifying the tenant-scoped/raw/transaction
// Prisma client types blows up TypeScript's comparison stack in this
// codebase, the same issue documented in lib/applications.ts and
// lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveDrives(db: any, collegeId: string, batchId: string | null = null): Promise<ActiveDrive[]> {
  const drives = await db.drive.findMany({
    where: { status: { notIn: INACTIVE_STATUSES }, ...(batchId ? { batchId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      company: { select: { name: true } },
      eligibleCourses: { select: { courseId: true } },
      _count: { select: { applications: true } },
    },
  });

  const result: ActiveDrive[] = await Promise.all(
    drives.map(
      async (drive: {
        id: string;
        title: string;
        status: string;
        company: { name: string };
        eligibleCourses: { courseId: string }[];
        _count: { applications: number };
      }) => {
        const courseIds = drive.eligibleCourses.map((c) => c.courseId);
        const eligible =
          courseIds.length === 0
            ? 0
            : await db.student.count({ where: { courseId: { in: courseIds }, ...(batchId ? { batchId } : {}) } });
        const applied = drive._count.applications;
        const appliedPct = eligible > 0 ? Math.round((applied / eligible) * 100) : 0;

        return {
          id: drive.id,
          title: drive.title,
          company: drive.company.name,
          eligible,
          applied,
          appliedPct,
          status: drive.status,
          href: `/drives/${drive.id}`,
        };
      },
    ),
  );

  return result;
}
