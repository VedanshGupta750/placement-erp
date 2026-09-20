import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { AttendancePanel, type AttendanceRow } from "@/components/events/attendance-panel";

export async function AttendanceTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [confirmedRegistrations, attendances, canMark] = await Promise.all([
    db.eventRegistration.findMany({
      where: { eventId, status: "CONFIRMED" },
      include: { user: { include: { studentProfile: { include: { course: true, batch: true } } } } },
      orderBy: { registeredAt: "asc" },
    }),
    db.eventAttendance.findMany({ where: { eventId } }),
    hasPermission(session, "event.mark_attendance"),
  ]);

  const attendanceByUserId = new Map(attendances.map((a) => [a.userId, a]));

  const registeredCount = confirmedRegistrations.length;
  const presentCount = attendances.filter((a) => a.checkInAt).length;
  const absentCount = registeredCount - presentCount;
  const attendanceRate = registeredCount > 0 ? Math.round((presentCount / registeredCount) * 100) : 0;

  const rows: AttendanceRow[] = confirmedRegistrations.map((r) => {
    const a = attendanceByUserId.get(r.userId);
    return {
      userId: r.userId,
      studentName: r.user.name,
      branch: r.user.studentProfile?.course ? (r.user.studentProfile.course.specialization ?? r.user.studentProfile.course.name) : "—",
      present: Boolean(a?.checkInAt),
      checkInAt: a?.checkInAt ? a.checkInAt.toISOString() : null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Registered" value={registeredCount} />
        <Stat label="Present" value={presentCount} />
        <Stat label="Absent" value={absentCount} />
        <Stat label="Attendance Rate" value={`${attendanceRate}%`} />
      </div>

      <AttendancePanel eventId={eventId} rows={rows} canMark={canMark} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
