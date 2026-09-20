import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deriveEventStatus } from "@/lib/events/status";
import { CheckinPanel } from "@/components/events/checkin-panel";

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default async function EventCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const [registration, attendance] = await Promise.all([
    db.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId: session.userId } } }),
    db.eventAttendance.findUnique({ where: { eventId_userId: { eventId, userId: session.userId } } }),
  ]);

  const status = deriveEventStatus(event);
  const isConfirmed = registration?.status === "CONFIRMED";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href={`/events/${eventId}`} />}>
        <ArrowLeft className="size-3.5" /> Back to event
      </Button>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <h1 className="text-lg font-semibold">{event.title}</h1>

          {!isConfirmed && <p className="text-muted-foreground text-sm">You&apos;re not registered for this event.</p>}

          {isConfirmed && status !== "LIVE" && !attendance?.checkInAt && (
            <p className="text-muted-foreground text-sm">Check-in opens once the event goes live.</p>
          )}

          {isConfirmed && (status === "LIVE" || attendance?.checkInAt) && (
            <CheckinPanel
              eventId={eventId}
              isLive={status === "LIVE"}
              checkInAt={attendance?.checkInAt ? attendance.checkInAt.toISOString() : null}
              checkOutAt={attendance?.checkOutAt ? attendance.checkOutAt.toISOString() : null}
              durationLabel={
                attendance?.checkInAt && attendance?.checkOutAt
                  ? formatDuration(attendance.checkOutAt.getTime() - attendance.checkInAt.getTime())
                  : null
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
