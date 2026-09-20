import { CalendarClock, CalendarRange, ClipboardCheck, Users2 } from "lucide-react";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { deriveEventStatus } from "@/lib/events/status";

// Self-contained, real-DB-values stat row for the Events home — same
// "fetches its own data" pattern as the Event 360 tabs, so this can be
// dropped anywhere without page.tsx having to thread extra queries through.
export async function EventSummaryCards({ collegeId }: { collegeId: string }) {
  const db = getTenantDb(collegeId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const events = await db.event.findMany({
    select: {
      id: true,
      publishedAt: true,
      cancelledAt: true,
      startAt: true,
      endAt: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
    },
  });

  const eventIds = events.map((e) => e.id);

  const upcomingCount = events.filter((e) => {
    const status = deriveEventStatus(e, now);
    return status === "SCHEDULED" || status === "REGISTRATION_OPEN" || status === "REGISTRATION_CLOSED";
  }).length;

  const thisMonthCount = events.filter(
    (e) => e.startAt && e.startAt >= monthStart && e.startAt < monthEnd && !e.cancelledAt,
  ).length;

  const [registrationCount, confirmedRegistrationCount, checkedInCount] = eventIds.length
    ? await Promise.all([
        db.eventRegistration.count({ where: { eventId: { in: eventIds } } }),
        db.eventRegistration.count({ where: { eventId: { in: eventIds }, status: "CONFIRMED" } }),
        db.eventAttendance.count({ where: { eventId: { in: eventIds }, checkInAt: { not: null } } }),
      ])
    : [0, 0, 0];

  const attendanceRate = confirmedRegistrationCount > 0 ? Math.round((checkedInCount / confirmedRegistrationCount) * 100) : null;

  const cards = [
    { label: "Upcoming Events", value: upcomingCount.toLocaleString("en-IN"), icon: CalendarClock },
    { label: "Registrations", value: registrationCount.toLocaleString("en-IN"), icon: Users2 },
    { label: "This Month", value: thisMonthCount.toLocaleString("en-IN"), icon: CalendarRange },
    { label: "Attendance Rate", value: attendanceRate === null ? "—" : `${attendanceRate}%`, icon: ClipboardCheck },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-muted-foreground size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold tracking-tight">{value}</div>
              <div className="text-muted-foreground text-xs">{label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
