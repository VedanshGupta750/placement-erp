import Link from "next/link";
import { Clock, Calendar, Radio, CheckCircle2, TrendingUp, Target, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InterviewsFilterPanel } from "@/components/interviews/interviews-filter-panel";
import { InterviewsTable, type InterviewRow } from "@/components/interviews/interviews-table";
import { PipelineOverviewPanel } from "@/components/interviews/pipeline-overview-panel";
import { TodaysSchedulePanel } from "@/components/interviews/today-schedule-panel";
import { InterviewActivityPanel } from "@/components/interviews/interview-activity-panel";
import { getInterviewListStats, getInterviewPipelineBreakdown } from "@/lib/interviews/stats";
import { cn } from "@/lib/utils";

type SearchParams = {
  q?: string;
  driveId?: string;
  roundType?: string;
  status?: string;
  mode?: string;
  interviewer?: string;
  dateFrom?: string;
  dateTo?: string;
  tab?: string;
};

const TABS: { key: string; label: string; statuses?: string[] }[] = [
  { key: "all", label: "All" },
  { key: "needs-scheduling", label: "Needs Scheduling", statuses: ["ASSIGNED"] },
  { key: "scheduled", label: "Scheduled", statuses: ["SCHEDULED", "CHECKED_IN"] },
  { key: "in-progress", label: "In Progress", statuses: ["IN_PROGRESS", "COMPLETED"] },
  { key: "passed", label: "Passed", statuses: ["PASSED"] },
  { key: "failed", label: "Failed", statuses: ["FAILED"] },
  { key: "no-show", label: "No Show", statuses: ["NO_SHOW"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
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
  const canViewActivity = await hasPermission(session, "audit.view");

  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";
  const activeTabDef = TABS.find((t) => t.key === activeTab)!;

  const where: Record<string, unknown> = {};
  if (params.q) {
    where.OR = [
      { student: { user: { name: { contains: params.q, mode: "insensitive" } } } },
      { student: { enrollmentNumber: { contains: params.q, mode: "insensitive" } } },
      { round: { drive: { title: { contains: params.q, mode: "insensitive" } } } },
      { round: { drive: { company: { name: { contains: params.q, mode: "insensitive" } } } } },
      { interviewerName: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.driveId) where.round = { ...(where.round as object), driveId: params.driveId };
  if (params.roundType) where.round = { ...(where.round as object), roundType: params.roundType };
  if (params.status) where.status = params.status;
  else if (activeTabDef.statuses) where.status = { in: activeTabDef.statuses };
  if (params.mode) where.mode = params.mode;
  if (params.interviewer) where.interviewerName = params.interviewer;
  if (params.dateFrom || params.dateTo) {
    where.scheduledAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
    };
  }

  // The active batch is the working scope, so it folds into the base
  // `where` alongside the other filters rather than being applied only to
  // the row list.
  const activeBatchId = await getActiveBatchId();
  if (activeBatchId) where.student = { ...(where.student as object), batchId: activeBatchId };

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [candidates, stats, pipeline, drives, roundTypeRows, interviewerRows, todayRows, activityRows] = await Promise.all([
    db.roundCandidate.findMany({
      where,
      include: { student: { include: { user: true } }, application: { select: { id: true } }, round: { include: { drive: { include: { company: true } } } } },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    }),
    getInterviewListStats(db, where),
    getInterviewPipelineBreakdown(db, where),
    db.drive.findMany({ where: activeBatchId ? { batchId: activeBatchId } : {}, select: { id: true, title: true, company: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.selectionRound.findMany({ select: { roundType: true }, distinct: ["roundType"], orderBy: { roundType: "asc" } }),
    db.roundCandidate.findMany({ where: { interviewerName: { not: null } }, select: { interviewerName: true }, distinct: ["interviewerName"], orderBy: { interviewerName: "asc" } }),
    db.roundCandidate.findMany({
      where: { scheduledAt: { gte: todayStart, lte: todayEnd }, ...(activeBatchId ? { student: { batchId: activeBatchId } } : {}) },
      include: { student: { include: { user: true } }, round: { include: { drive: { include: { company: true } } } } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    canViewActivity
      ? db.auditLog.findMany({ where: { resourceType: "RoundCandidate" }, orderBy: { createdAt: "desc" }, take: 5, include: { actor: { select: { name: true } } } })
      : Promise.resolve([]),
  ]);

  const activeFilterCount = Object.values(params).filter(Boolean).length;

  function hrefWith(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/interviews?${qs}` : "/interviews";
  }

  const rows: InterviewRow[] = candidates.map((c) => ({
    id: c.id,
    status: c.status,
    score: c.score,
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    mode: c.mode,
    venue: c.venue,
    meetingUrl: c.meetingUrl,
    interviewerName: c.interviewerName,
    interviewerId: c.interviewerId,
    studentName: c.student.user.name,
    studentId: c.studentId,
    applicationId: c.application.id,
    driveId: c.round.drive.id,
    driveTitle: c.round.drive.title,
    companyName: c.round.drive.company.name,
    roundName: c.round.name,
    roundType: c.round.roundType,
  }));

  const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  const exportHref = exportQs ? `/api/interviews/export?${exportQs}` : "/api/interviews/export";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
          <p className="text-muted-foreground text-sm">Manage interview rounds, schedules, evaluations and outcomes across all placement drives.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/interviews/calendar" />}>
            <Calendar className="size-4" /> Calendar View
          </Button>
          <Button variant="outline" render={<Link href="/interviews/scorecards" />}>
            Scorecard Templates
          </Button>
          <Button variant="outline" render={<a href={exportHref} />}>
            <FileText className="size-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <Link href={hrefWith({ tab: "needs-scheduling" })}><StatCard icon={Clock} label="Needs Scheduling" value={stats.needsScheduling} sublabel="Candidates waiting" color="amber" /></Link>
        <Link href={hrefWith({ tab: "all", dateFrom: undefined, dateTo: undefined })}>
          <StatCard icon={Calendar} label="Today" value={stats.today.total} sublabel={`${stats.today.upcoming} upcoming · ${stats.today.inProgress} live · ${stats.today.completed} done`} color="violet" />
        </Link>
        <Link href={hrefWith({ tab: "in-progress" })}><StatCard icon={Radio} label="In Progress" value={stats.inProgress} sublabel="Live interviews" color="blue" /></Link>
        <Link href={hrefWith({ status: undefined, tab: "all" })}><StatCard icon={CheckCircle2} label="Completed" value={stats.completed} sublabel="This placement season" color="emerald" /></Link>
        <StatCard icon={Target} label="Pass Rate" value={stats.passRate !== null ? `${stats.passRate}%` : "-"} color="teal" />
        <StatCard icon={TrendingUp} label="Avg. Score" value={stats.avgScore !== null ? `${stats.avgScore}/100` : "-"} color="sky" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <form className="min-w-0 flex-1">
              {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
              <Input name="q" placeholder="Search student, enrollment no., company, drive, interviewer…" defaultValue={params.q} />
            </form>
            <InterviewsFilterPanel
              drives={drives.map((d) => ({ id: d.id, title: d.title, companyName: d.company.name }))}
              roundTypes={roundTypeRows.map((r: { roundType: string }) => r.roundType)}
              interviewers={interviewerRows.map((r: { interviewerName: string | null }) => r.interviewerName!)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 border-b">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={hrefWith({ tab: t.key === "all" ? undefined : t.key })}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>

          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <p className="text-muted-foreground mb-3 text-xs">
                {candidates.length} interview{candidates.length === 1 ? "" : "s"}{activeFilterCount > 0 ? " matching filters" : ""} shown.
              </p>
              <InterviewsTable rows={rows} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <TodaysSchedulePanel
            rows={todayRows.map((c: { id: string; scheduledAt: Date | null; status: string; student: { user: { name: string } }; round: { name: string; drive: { company: { name: string } } } }) => ({
              id: c.id,
              time: c.scheduledAt ? new Date(c.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-",
              studentName: c.student.user.name,
              companyName: c.round.drive.company.name,
              roundName: c.round.name,
              status: c.status,
            }))}
          />
          <PipelineOverviewPanel rows={pipeline} />
          {canViewActivity && (
            <InterviewActivityPanel
              entries={activityRows.map((a: { id: string; action: string; createdAt: Date; actor: { name: string } | null }) => ({
                id: a.id,
                action: a.action,
                createdAt: a.createdAt.toISOString(),
                actorName: a.actor?.name ?? null,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
