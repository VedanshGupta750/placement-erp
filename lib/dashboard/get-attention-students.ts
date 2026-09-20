// No "server-only" guard — kept usable the same way lib/applications.ts and
// lib/notify.ts are. Flags eligible students who need placement-cell
// attention using real, defensible heuristics — never fabricated data.

export type AttentionStudent = {
  id: string;
  name: string;
  initials: string;
  // e.g. "Computer Science" — derived from course.specialization ?? course.name.
  // There's no real "year" field on Student, so we don't fabricate one.
  courseLabel: string;
  flag: "Low Applications" | "Resume Missing" | "At Risk" | "No Activity" | "Documents Pending";
  eligibleDrivesCount: number;
  appliedCount: number;
  href: string;
};

// Priority order used both to pick a student's single flag (most specific
// wins) and to sort the final list (most urgent first).
const FLAG_PRIORITY: AttentionStudent["flag"][] = [
  "Resume Missing",
  "At Risk",
  "Low Applications",
  "No Activity",
  "Documents Pending",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// `db` is intentionally untyped (`any`) — this function is called with the
// tenant-scoped client, and unifying the tenant-scoped/raw/transaction
// Prisma client types blows up TypeScript's comparison stack in this
// codebase, the same issue documented in lib/applications.ts and
// lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAttentionStudents(db: any, collegeId: string, limit = 8, batchId: string | null = null): Promise<AttentionStudent[]> {
  const students = await db.student.findMany({
    where: { eligibleForPlacements: true, ...(batchId ? { batchId } : {}) },
    select: {
      id: true,
      courseId: true,
      liveBacklogs: true,
      user: { select: { name: true } },
      course: { select: { name: true, specialization: true } },
      resumes: { where: { isDefault: true }, select: { id: true }, take: 1 },
      _count: { select: { applications: true } },
    },
  });

  if (students.length === 0) return [];

  // Number of distinct courses is small relative to the student body, so a
  // per-course published-drive-eligibility count is cheap and keeps this
  // type-simple rather than hand-rolling a groupBy over a join table.
  const courseIds: string[] = Array.from(
    new Set(students.map((s: { courseId: string }) => s.courseId)),
  );
  const eligibleDrivesByCourse = new Map<string, number>();
  await Promise.all(
    courseIds.map(async (courseId) => {
      const count = await db.drive.count({
        where: { status: "PUBLISHED", eligibleCourses: { some: { courseId } }, ...(batchId ? { batchId } : {}) },
      });
      eligibleDrivesByCourse.set(courseId, count);
    }),
  );

  const flagged: AttentionStudent[] = [];

  for (const student of students) {
    const hasDefaultResume = student.resumes.length > 0;
    const appliedCount: number = student._count.applications;
    const eligibleDrivesCount = eligibleDrivesByCourse.get(student.courseId) ?? 0;

    // Priority order so each student gets exactly one, most-specific flag.
    let flag: AttentionStudent["flag"] | null = null;
    if (!hasDefaultResume) {
      flag = "Resume Missing";
    } else if (student.liveBacklogs > 0 && appliedCount === 0) {
      flag = "At Risk";
    } else if (eligibleDrivesCount >= 3 && appliedCount <= 1) {
      flag = "Low Applications";
    } else if (appliedCount === 0) {
      flag = "No Activity";
    }

    if (!flag) continue;

    flagged.push({
      id: student.id,
      name: student.user.name,
      initials: initialsOf(student.user.name),
      courseLabel: student.course.specialization ?? student.course.name,
      flag,
      eligibleDrivesCount,
      appliedCount,
      href: `/students/${student.id}`,
    });
  }

  flagged.sort((a, b) => FLAG_PRIORITY.indexOf(a.flag) - FLAG_PRIORITY.indexOf(b.flag));

  return flagged.slice(0, limit);
}
