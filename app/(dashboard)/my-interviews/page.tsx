import Link from "next/link";
import { Calendar, Clock3, CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";

// The "Interviewer Dashboard" from the spec — self-scoped by
// interviewerId=session.userId, same pattern as "My applications"/
// "My offers" for students: no special permission needed since a staff
// account can only ever see interviews assigned to themselves here.
export default async function MyInterviewsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { userType: true, name: true } });
  if (user.userType === "STUDENT") {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">This page is for interviewers.</CardContent>
      </Card>
    );
  }

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [todayCandidates, pendingEvaluations, completedCount, upcoming] = await Promise.all([
    db.roundCandidate.findMany({
      where: { interviewerId: session.userId, scheduledAt: { gte: todayStart, lte: todayEnd } },
      include: { student: { include: { user: true } }, round: { include: { drive: { include: { company: true } } } } },
      orderBy: { scheduledAt: "asc" },
    }),
    db.roundCandidate.count({ where: { interviewerId: session.userId, status: "COMPLETED" } }),
    db.roundCandidate.count({ where: { interviewerId: session.userId, status: { in: ["PASSED", "FAILED"] } } }),
    db.roundCandidate.findMany({
      where: { interviewerId: session.userId, status: { in: ["SCHEDULED", "CHECKED_IN"] }, scheduledAt: { gt: todayEnd } },
      include: { student: { include: { user: true } }, round: { include: { drive: { include: { company: true } } } } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm">Your interview schedule and evaluations.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Calendar} label="Today's Interviews" value={todayCandidates.length} color="blue" />
        <StatCard icon={Clock3} label="Pending Evaluations" value={pendingEvaluations} color="amber" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedCount} color="emerald" />
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y pt-6">
          <h2 className="mb-2 text-sm font-medium">Today&apos;s schedule</h2>
          {todayCandidates.map((c: { id: string; status: string; scheduledAt: Date | null; student: { user: { name: string } }; round: { name: string; drive: { company: { name: string } } } }) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-16 shrink-0 tabular-nums">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                <div>
                  <div className="font-medium">{c.student.user.name}</div>
                  <div className="text-muted-foreground text-xs">{c.round.drive.company.name} · {c.round.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={c.status} />
                <Button size="sm" variant="outline" render={<Link href={`/interviews/${c.id}`} />}>Open</Button>
              </div>
            </div>
          ))}
          {todayCandidates.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No interviews assigned to you today.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col divide-y pt-6">
          <h2 className="mb-2 text-sm font-medium">Upcoming</h2>
          {upcoming.map((c: { id: string; status: string; scheduledAt: Date | null; student: { user: { name: string } }; round: { name: string; drive: { company: { name: string } } } }) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="font-medium">{c.student.user.name}</div>
                <div className="text-muted-foreground text-xs">
                  {c.round.drive.company.name} · {c.round.name} · {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                </div>
              </div>
              <Button size="sm" variant="outline" render={<Link href={`/interviews/${c.id}`} />}>Open</Button>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">Nothing else scheduled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
