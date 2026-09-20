import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { RegistrationsTable, type RegistrationRow } from "@/components/events/registrations-table";

export async function RegistrationsTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [registrations, canManage] = await Promise.all([
    db.eventRegistration.findMany({
      where: { eventId },
      include: { user: { include: { studentProfile: { include: { course: true, batch: true } } } } },
      orderBy: { registeredAt: "desc" },
    }),
    hasPermission(session, "event.manage_registrations"),
  ]);

  const totalRegistered = registrations.length;
  const confirmedCount = registrations.filter((r) => r.status === "CONFIRMED").length;
  const waitlistedCount = registrations.filter((r) => r.status === "WAITLISTED").length;

  const rows: RegistrationRow[] = registrations.map((r) => ({
    id: r.id,
    studentName: r.user.name,
    branch: r.user.studentProfile?.course ? (r.user.studentProfile.course.specialization ?? r.user.studentProfile.course.name) : "—",
    year: r.user.studentProfile?.batch?.year ?? null,
    status: r.status,
    registeredAt: r.registeredAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Registered</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{totalRegistered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Confirmed</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{confirmedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Waitlisted</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{waitlistedCount}</div>
          </CardContent>
        </Card>
      </div>

      <RegistrationsTable eventId={eventId} rows={rows} canManage={canManage} />
    </div>
  );
}
