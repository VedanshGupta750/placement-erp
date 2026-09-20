import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder — full Schedule/agenda tab lands in a follow-up pass.
export async function ScheduleTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { startAt: true, endAt: true, mode: true, venue: true, meetingUrl: true } });

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6 text-sm">
        {event.startAt && <div>Starts: {event.startAt.toLocaleString("en-IN")}</div>}
        {event.endAt && <div>Ends: {event.endAt.toLocaleString("en-IN")}</div>}
        <div>Mode: {event.mode}</div>
        {event.venue && <div>Venue: {event.venue}</div>}
        {event.meetingUrl && <div>Link: {event.meetingUrl}</div>}
      </CardContent>
    </Card>
  );
}
