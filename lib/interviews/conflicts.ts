// Real conflict detection against existing scheduled interviews — not a
// fake "AI availability check". Interviewer conflicts prefer matching by
// interviewerId (a real User) when the interviewer is a linked staff
// account; free-text-only interviewers (external panelists) still get
// matched by exact name string as a fallback. There's no per-interview
// duration field, so every slot is treated as a fixed 60-minute window.
const SLOT_MINUTES = 60;
const ACTIVE_STATUSES = ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"];

export type ScheduleConflict = { type: "interviewer" | "student"; message: string };

export async function findScheduleConflicts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  params: { scheduledAt: Date; interviewerId?: string | null; interviewerName?: string | null; studentId: string; excludeCandidateId?: string },
): Promise<ScheduleConflict[]> {
  const windowStart = new Date(params.scheduledAt.getTime() - SLOT_MINUTES * 60 * 1000);
  const windowEnd = new Date(params.scheduledAt.getTime() + SLOT_MINUTES * 60 * 1000);
  const conflicts: ScheduleConflict[] = [];

  const interviewerWhere = params.interviewerId
    ? { interviewerId: params.interviewerId }
    : params.interviewerName
      ? { interviewerName: params.interviewerName }
      : null;

  const [interviewerHits, studentHits] = await Promise.all([
    interviewerWhere
      ? db.roundCandidate.findMany({
          where: {
            ...interviewerWhere,
            status: { in: ACTIVE_STATUSES },
            scheduledAt: { gte: windowStart, lte: windowEnd },
            ...(params.excludeCandidateId ? { id: { not: params.excludeCandidateId } } : {}),
          },
          select: { scheduledAt: true },
          take: 1,
        })
      : Promise.resolve([]),
    db.roundCandidate.findMany({
      where: {
        studentId: params.studentId,
        status: { in: ACTIVE_STATUSES },
        scheduledAt: { gte: windowStart, lte: windowEnd },
        ...(params.excludeCandidateId ? { id: { not: params.excludeCandidateId } } : {}),
      },
      select: { scheduledAt: true },
      take: 1,
    }),
  ]);

  if (interviewerHits.length > 0) {
    const at = new Date(interviewerHits[0].scheduledAt as Date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    conflicts.push({ type: "interviewer", message: `${params.interviewerName ?? "This interviewer"} already has an interview around ${at}.` });
  }
  if (studentHits.length > 0) {
    const at = new Date(studentHits[0].scheduledAt as Date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    conflicts.push({ type: "student", message: `This student already has an interview around ${at}.` });
  }

  return conflicts;
}
