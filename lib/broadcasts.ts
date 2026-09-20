// Resolves a Broadcast's targeting fields into a concrete list of userIds.
// Shared between the preview-count endpoint and the actual send so the
// count a TPO sees before sending always matches who it actually goes to.
// Untyped `db` for the same reason as lib/notify.ts / lib/applications.ts.
export type AudienceInput = {
  audienceType: "ALL_STUDENTS" | "ALL_STAFF" | "BATCH" | "DEPARTMENT" | "COURSE" | "ROLE";
  audienceBatchId?: string | null;
  audienceDepartmentId?: string | null;
  audienceCourseId?: string | null;
  audienceRole?: string | null;
};

export async function resolveAudienceUserIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  collegeId: string,
  audience: AudienceInput,
): Promise<string[]> {
  switch (audience.audienceType) {
    case "ALL_STUDENTS": {
      const users = await db.user.findMany({ where: { collegeId, userType: "STUDENT" }, select: { id: true } });
      return users.map((u: { id: string }) => u.id);
    }
    case "ALL_STAFF": {
      const users = await db.user.findMany({ where: { collegeId, userType: { not: "STUDENT" } }, select: { id: true } });
      return users.map((u: { id: string }) => u.id);
    }
    case "BATCH": {
      const students = await db.student.findMany({ where: { batchId: audience.audienceBatchId! }, select: { userId: true } });
      return students.map((s: { userId: string }) => s.userId);
    }
    case "DEPARTMENT": {
      const students = await db.student.findMany({ where: { departmentId: audience.audienceDepartmentId! }, select: { userId: true } });
      return students.map((s: { userId: string }) => s.userId);
    }
    case "COURSE": {
      const students = await db.student.findMany({ where: { courseId: audience.audienceCourseId! }, select: { userId: true } });
      return students.map((s: { userId: string }) => s.userId);
    }
    case "ROLE": {
      const users = await db.user.findMany({ where: { collegeId, role: { name: audience.audienceRole! } }, select: { id: true } });
      return users.map((u: { id: string }) => u.id);
    }
    default:
      return [];
  }
}
