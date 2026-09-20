import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";

// Same default-duration fallback used by lib/events/status.ts when an event
// has no explicit endAt — kept as a local constant since status.ts doesn't
// export it.
const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export type ScheduleConflict = {
  id: string;
  title: string;
  startAt: Date | null;
  endAt: Date | null;
  reason: "venue" | "speaker";
};

// Finds already-scheduled events that overlap the given time range AND
// share either the same venue (exact string match) or the same speaker.
// Pure warning signal — deliberately non-blocking, callers just surface it
// as a banner. Cancelled events are excluded (a cancelled slot frees up the
// venue/speaker), and events with no startAt can't conflict by definition.
export async function findScheduleConflicts(
  db: TenantDb,
  params: {
    startAt: Date;
    endAt: Date;
    venue?: string | null;
    speakerId?: string | null;
    excludeEventId?: string;
  },
): Promise<ScheduleConflict[]> {
  const { startAt, endAt, venue, speakerId, excludeEventId } = params;
  const trimmedVenue = venue?.trim() || null;
  if (!trimmedVenue && !speakerId) return [];

  const orClauses: Array<Record<string, unknown>> = [];
  if (trimmedVenue) orClauses.push({ venue: trimmedVenue });
  if (speakerId) orClauses.push({ speakerId });

  const candidates = await db.event.findMany({
    where: {
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      cancelledAt: null,
      startAt: { not: null },
      OR: orClauses,
    },
    select: { id: true, title: true, startAt: true, endAt: true, venue: true, speakerId: true },
  });

  const conflicts: ScheduleConflict[] = [];
  for (const candidate of candidates) {
    if (!candidate.startAt) continue;
    const candidateEnd = candidate.endAt ?? new Date(candidate.startAt.getTime() + DEFAULT_EVENT_DURATION_MS);
    const overlaps = startAt < candidateEnd && endAt > candidate.startAt;
    if (!overlaps) continue;

    if (trimmedVenue && candidate.venue === trimmedVenue) {
      conflicts.push({ id: candidate.id, title: candidate.title, startAt: candidate.startAt, endAt: candidate.endAt, reason: "venue" });
    } else if (speakerId && candidate.speakerId === speakerId) {
      conflicts.push({ id: candidate.id, title: candidate.title, startAt: candidate.startAt, endAt: candidate.endAt, reason: "speaker" });
    }
  }
  return conflicts;
}
