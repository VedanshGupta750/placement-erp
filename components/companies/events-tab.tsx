import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard } from "@/components/events/event-card";

// Company-scoped, read-only view into the existing Events module — reuses
// the same EventCard used by the main Events list (and, with it,
// deriveEventStatus/EVENT_STATUS_LABEL/EVENT_STATUS_CLASSES) so a company's
// event history renders identically to everywhere else events show up.
export async function EventsTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const events = await db.event.findMany({
    where: { companyId },
    include: { speaker: { select: { name: true } }, _count: { select: { registrations: true } } },
    orderBy: { startAt: "desc" },
  });

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">No events run with this company yet.</CardContent>
      </Card>
    );
  }

  type EventRow = {
    id: string;
    category: string;
    title: string;
    description: string;
    organizerLabel: string | null;
    mode: string;
    venue: string | null;
    startAt: Date | null;
    endAt: Date | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    publishedAt: Date | null;
    cancelledAt: Date | null;
    speaker: { name: string } | null;
    _count: { registrations: number };
  };

  return (
    <div className="flex flex-col gap-3">
      {events.map((e: EventRow) => (
        <EventCard
          key={e.id}
          event={{
            id: e.id,
            category: e.category,
            title: e.title,
            description: e.description,
            organizerLabel: e.organizerLabel,
            mode: e.mode,
            venue: e.venue,
            startAt: e.startAt,
            endAt: e.endAt,
            registrationOpensAt: e.registrationOpensAt,
            registrationClosesAt: e.registrationClosesAt,
            publishedAt: e.publishedAt,
            cancelledAt: e.cancelledAt,
            speakerName: e.speaker?.name ?? null,
            registrationCount: e._count.registrations,
          }}
          href={`/events/${e.id}`}
        />
      ))}
    </div>
  );
}
