import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventEligibleCount } from "@/lib/events/eligibility-runner";
import { deriveEventStatus } from "@/lib/events/status";

const MODE_LABEL: Record<string, string> = { ONLINE: "Online", OFFLINE: "In-person", HYBRID: "Hybrid" };

export async function OverviewTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { speaker: true, company: { select: { id: true, name: true } } },
  });

  const status = deriveEventStatus(event);
  const hasStarted = status === "LIVE" || status === "COMPLETED";

  const [eligibleCount, registrationCounts, drive, companyEventCount, speakerEventCount, presentCount] = await Promise.all([
    getEventEligibleCount(db, eventId),
    db.eventRegistration.groupBy({ where: { eventId }, by: ["status"], _count: { _all: true } }),
    event.driveId ? db.drive.findUnique({ where: { id: event.driveId }, select: { title: true } }) : Promise.resolve(null),
    event.companyId ? db.event.count({ where: { companyId: event.companyId, id: { not: eventId } } }) : Promise.resolve(0),
    event.speakerId ? db.event.count({ where: { speakerId: event.speakerId, id: { not: eventId } } }) : Promise.resolve(0),
    hasStarted ? db.eventAttendance.count({ where: { eventId, checkInAt: { not: null } } }) : Promise.resolve(0),
  ]);

  const totalRegistered = registrationCounts.reduce((sum, r) => sum + r._count._all, 0);
  const confirmedCount = registrationCounts.find((r) => r.status === "CONFIRMED")?._count._all ?? 0;
  const waitlistedCount = registrationCounts.find((r) => r.status === "WAITLISTED")?._count._all ?? 0;
  const attendanceRate = confirmedCount > 0 ? Math.round((presentCount / confirmedCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-0">
          <p className="text-muted-foreground whitespace-pre-wrap text-sm">{event.description}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              label="When"
              value={
                event.startAt
                  ? `${event.startAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${event.endAt ? ` – ${event.endAt.toLocaleString("en-IN", { timeStyle: "short" })}` : ""}`
                  : "Not scheduled"
              }
            />
            <InfoItem label="Where" value={`${MODE_LABEL[event.mode] ?? event.mode}${event.venue ? ` · ${event.venue}` : ""}`} />
            <InfoItem label="Organizer" value={event.organizerLabel ?? "—"} />
            <InfoItem
              label="Speaker"
              value={
                event.speaker
                  ? `${event.speaker.name}${event.speaker.organization ? ` (${event.speaker.organization})` : ""}${speakerEventCount > 0 ? ` · ${speakerEventCount} previous session${speakerEventCount === 1 ? "" : "s"}` : ""}`
                  : "—"
              }
            />
          </div>

          {event.company && (
            <p className="text-muted-foreground text-sm">
              Company: <span className="text-foreground font-medium">{event.company.name}</span>
              {companyEventCount > 0 && ` · ${companyEventCount} other event${companyEventCount === 1 ? "" : "s"} with this company`}
            </p>
          )}

          {drive && (
            <Link href={`/drives/${event.driveId}`} className="text-primary inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline">
              Related Drive: {drive.title} <ArrowRight className="size-3.5" />
            </Link>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Eligible Students" value={eligibleCount} />
        <StatCard label="Registered" value={totalRegistered} />
        <StatCard label="Confirmed" value={confirmedCount} sub={`${waitlistedCount} waitlisted`} />
        {hasStarted ? (
          <StatCard label="Attendance" value={`${presentCount}`} sub={`${attendanceRate}% of confirmed`} />
        ) : (
          <StatCard label="Attendance" value="—" sub="Available once event starts" />
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}
