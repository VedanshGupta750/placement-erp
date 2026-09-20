import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BAR_COLORS = ["bg-violet-500", "bg-blue-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500"];
const MIN_WIDTH_PCT = 6;

function BarList({ rows, emptyLabel }: { rows: { label: string; value: number }[]; emptyLabel: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row, index) => {
        const pct = max > 0 ? Math.max((row.value / max) * 100, MIN_WIDTH_PCT) : MIN_WIDTH_PCT;
        return (
          <div key={row.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-sm font-medium">{row.label}</div>
            <div className="flex-1">
              <div
                className={`flex h-6 items-center justify-end rounded px-2 ${BAR_COLORS[index % BAR_COLORS.length]}`}
                style={{ width: `${pct}%` }}
              >
                <span className="text-xs font-semibold text-white tabular-nums">{row.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

// Self-contained tab — gated on event.view_analytics per the RBAC convention
// used across the Event 360 page; everything below fetches its own data.
export async function AnalyticsTab({ eventId }: { eventId: string }) {
  const session = await requireSession();

  const canView = await hasPermission(session, "event.view_analytics");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          You don&apos;t have access to event analytics.
        </CardContent>
      </Card>
    );
  }

  const db = getTenantDb(session.collegeId);

  const [registrationCount, attendanceCount, feedbackAgg, registrations] = await Promise.all([
    db.eventRegistration.count({ where: { eventId } }),
    db.eventAttendance.count({ where: { eventId, checkInAt: { not: null } } }),
    db.eventFeedback.aggregate({ where: { eventId }, _avg: { rating: true }, _count: true }),
    db.eventRegistration.findMany({
      where: { eventId },
      select: {
        user: {
          select: {
            studentProfile: {
              select: {
                department: { select: { name: true } },
                batch: { select: { year: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const attendanceRate = registrationCount > 0 ? Math.round((attendanceCount / registrationCount) * 100) : 0;

  const departmentCounts = new Map<string, number>();
  const batchCounts = new Map<string, number>();
  for (const reg of registrations) {
    const student = reg.user.studentProfile;
    if (!student) continue;
    const deptLabel = student.department?.name ?? "Unassigned";
    departmentCounts.set(deptLabel, (departmentCounts.get(deptLabel) ?? 0) + 1);
    const batchLabel = String(student.batch.year);
    batchCounts.set(batchLabel, (batchCounts.get(batchLabel) ?? 0) + 1);
  }

  const departmentRows = Array.from(departmentCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const batchRows = Array.from(batchCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Registrations" value={registrationCount} />
        <StatTile label="Attendance" value={attendanceCount} sub={`${attendanceRate}% of registered`} />
        <StatTile label="Feedback responses" value={feedbackAgg._count} />
        <StatTile label="Avg. rating" value={feedbackAgg._avg.rating ? feedbackAgg._avg.rating.toFixed(1) : "—"} sub={feedbackAgg._avg.rating ? "out of 5" : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Department participation</CardTitle>
        </CardHeader>
        <CardContent>
          <BarList rows={departmentRows} emptyLabel="No student registrations yet." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batch participation</CardTitle>
        </CardHeader>
        <CardContent>
          <BarList rows={batchRows} emptyLabel="No student registrations yet." />
        </CardContent>
      </Card>
    </div>
  );
}
