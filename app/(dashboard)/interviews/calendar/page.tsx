import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarToolbar } from "@/components/interviews/calendar-toolbar";
import { CalendarEntryCard, type CalendarEntry } from "@/components/interviews/calendar-entry-card";
import { startOfWeek, startOfMonth, endOfMonth, addDays, toDateKey } from "@/lib/interviews/calendar";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function InterviewsCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const { view: rawView, date: dateParam } = await searchParams;
  const view = rawView === "day" || rawView === "month" ? rawView : "week";
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "interview.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to interviews.</CardContent>
      </Card>
    );
  }

  const anchor = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();

  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "day") {
    rangeStart = new Date(anchor); rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(anchor); rangeEnd.setHours(23, 59, 59, 999);
  } else if (view === "month") {
    rangeStart = startOfWeek(startOfMonth(anchor));
    rangeEnd = addDays(startOfWeek(endOfMonth(anchor)), 6);
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    rangeStart = startOfWeek(anchor);
    rangeEnd = addDays(rangeStart, 6);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const candidates = await db.roundCandidate.findMany({
    where: { scheduledAt: { gte: rangeStart, lte: rangeEnd } },
    include: { student: { include: { user: true } }, round: { include: { drive: { include: { company: true } } } } },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });

  const byDay = new Map<string, CalendarEntry[]>();
  for (const c of candidates) {
    if (!c.scheduledAt) continue;
    const key = toDateKey(c.scheduledAt);
    const entry: CalendarEntry = {
      id: c.id,
      time: c.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      studentName: c.student.user.name,
      companyName: c.round.drive.company.name,
      roundName: c.round.name,
      status: c.status,
    };
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  function hrefFor(v: string, d: Date) {
    return `/interviews/calendar?view=${v}&date=${toDateKey(d)}`;
  }

  let label: string;
  let prevHref: string;
  let nextHref: string;
  if (view === "day") {
    label = anchor.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    prevHref = hrefFor("day", addDays(anchor, -1));
    nextHref = hrefFor("day", addDays(anchor, 1));
  } else if (view === "month") {
    label = anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    prevHref = hrefFor("month", addDays(startOfMonth(anchor), -1));
    nextHref = hrefFor("month", addDays(endOfMonth(anchor), 1));
  } else {
    const weekStart = startOfWeek(anchor);
    const weekEnd = addDays(weekStart, 6);
    label = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
    prevHref = hrefFor("week", addDays(weekStart, -7));
    nextHref = hrefFor("week", addDays(weekStart, 7));
  }
  const todayHref = hrefFor(view, new Date());

  return (
    <div className="flex flex-col gap-6">
      <Link href="/interviews" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to interviews
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interview calendar</h1>
        <p className="text-muted-foreground text-sm">{candidates.length} scheduled interview{candidates.length === 1 ? "" : "s"} in this range.</p>
      </div>

      <CalendarToolbar view={view} label={label} prevHref={prevHref} nextHref={nextHref} todayHref={todayHref} />

      {view === "day" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {(byDay.get(toDateKey(anchor)) ?? []).map((e) => <CalendarEntryCard key={e.id} entry={e} />)}
            {(byDay.get(toDateKey(anchor)) ?? []).length === 0 && <p className="text-muted-foreground py-10 text-center text-sm">No interviews scheduled this day.</p>}
          </CardContent>
        </Card>
      )}

      {view === "week" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)).map((d) => {
            const key = toDateKey(d);
            const entries = byDay.get(key) ?? [];
            const isToday = key === toDateKey(new Date());
            return (
              <div key={key} className="flex flex-col gap-2">
                <div className={cn("text-center text-xs font-medium", isToday && "text-primary")}>
                  {DAY_LABELS[d.getDay()]} {d.getDate()}
                </div>
                <div className="flex flex-col gap-1.5">
                  {entries.map((e) => <CalendarEntryCard key={e.id} entry={e} />)}
                  {entries.length === 0 && <div className="text-muted-foreground py-2 text-center text-xs">-</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-muted-foreground text-center text-xs font-medium">{d}</div>
          ))}
          {Array.from({ length: Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1 }, (_, i) => addDays(rangeStart, i)).map((d) => {
            const key = toDateKey(d);
            const entries = byDay.get(key) ?? [];
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = key === toDateKey(new Date());
            return (
              <Link
                key={key}
                href={hrefFor("day", d)}
                className={cn(
                  "flex min-h-20 flex-col gap-1 rounded-md border p-1.5 text-xs",
                  !inMonth && "opacity-40",
                  isToday && "border-primary",
                )}
              >
                <span className="font-medium">{d.getDate()}</span>
                {entries.length > 0 && <span className="bg-primary/10 text-primary w-fit rounded px-1.5 py-0.5">{entries.length}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
