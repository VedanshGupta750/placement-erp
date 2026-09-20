import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { getEligibleStudentsForEvent } from "@/lib/events/eligibility-runner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SendAnnouncementForm, ReminderButtons } from "@/components/events/send-announcement-form";

type AnnouncementLogEntry = {
  audience?: string;
  audienceLabel?: string;
  subject?: string;
  recipientCount?: number;
};

// Communication tab — "Send announcement" (Registered / Waitlisted /
// Eligible-not-registered) + honest "send now" reminder presets + a log of
// past announcements read back from the audit trail (event.announcement_sent
// is already registered in lib/audit.ts's AUDIT_LABELS).
export async function CommunicationTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [event, canManage] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      select: { title: true, speaker: { select: { name: true, email: true } } },
    }),
    hasPermission(session, "event.manage_registrations"),
  ]);

  if (!event) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">Event not found.</CardContent>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          You don&apos;t have permission to send announcements for this event.
        </CardContent>
      </Card>
    );
  }

  const [registeredCount, waitlistedCount, allRegistrations, announcements] = await Promise.all([
    db.eventRegistration.count({ where: { eventId, status: { in: ["PENDING", "CONFIRMED"] } } }),
    db.eventRegistration.count({ where: { eventId, status: "WAITLISTED" } }),
    db.eventRegistration.findMany({ where: { eventId }, select: { userId: true } }),
    db.auditLog.findMany({
      where: { resourceType: "Event", resourceId: eventId, action: "event.announcement_sent" },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const eligibleStudents = await getEligibleStudentsForEvent(db, eventId);
  const registeredIds = new Set(allRegistrations.map((r) => r.userId));
  const eligibleNotRegisteredCount = eligibleStudents.filter((s) => !registeredIds.has(s.userId)).length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Send announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <SendAnnouncementForm
            eventId={eventId}
            audienceCounts={{ REGISTERED: registeredCount, WAITLISTED: waitlistedCount, ELIGIBLE: eligibleNotRegisteredCount }}
          />
        </CardContent>
      </Card>

      {event.speaker?.email && (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            Speaker: <span className="text-foreground font-medium">{event.speaker.name}</span> isn&apos;t a platform
            account, so an in-app notification can&apos;t reach them — contact directly at{" "}
            <a className="text-foreground underline" href={`mailto:${event.speaker.email}`}>
              {event.speaker.email}
            </a>
            .
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            There&apos;s no scheduler in this app — each button below sends its reminder to registered students
            immediately, right now. Nothing here is ever scheduled for later.
          </p>
          <ReminderButtons eventId={eventId} eventTitle={event.title} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Announcement log</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {announcements.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">No announcements sent yet.</p>
          )}
          {announcements.map((a) => {
            const after = (a.after ?? {}) as AnnouncementLogEntry;
            return (
              <div key={a.id} className="flex flex-col gap-1 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{after.subject ?? "(no subject)"}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {a.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{after.audienceLabel ?? after.audience ?? "Unknown audience"}</Badge>
                  <span>
                    {after.recipientCount ?? 0} recipient{after.recipientCount === 1 ? "" : "s"}
                  </span>
                  {a.actor?.name && <span>· by {a.actor.name}</span>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
