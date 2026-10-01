import Link from "next/link";
import { Briefcase, Upload, Rocket, Users, CheckCircle2, FileCheck2 } from "lucide-react";
import { CreateDriveMenu } from "@/components/drives/create-drive-menu";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/stat-card";
import { DrivesFilterPanel } from "@/components/drives/drives-filter-panel";
import { DrivesSavedViewsDropdown } from "@/components/drives/drives-saved-views-dropdown";
import { DrivesTable, type DriveRow } from "@/components/drives/drives-table";
import { DrivesCalendar, type CalendarEvent } from "@/components/drives/drives-calendar";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";

type SearchParams = {
  q?: string;
  status?: string;
  companyId?: string;
  courseId?: string;
  locationCategory?: string;
  positionType?: string;
  departmentId?: string;
  sourceType?: string;
  createdById?: string;
  minCtc?: string;
  maxCtc?: string;
  regClosesFrom?: string;
  regClosesTo?: string;
  driveDateFrom?: string;
  driveDateTo?: string;
  minApplications?: string;
  minShortlisted?: string;
  minOffers?: string;
  hasEligibilityRule?: string;
  hasInterviews?: string;
  hasOffers?: string;
  tab?: string;
  view?: string;
  year?: string;
  month?: string;
};

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

const TABS: { key: string; label: string; statuses?: string[] }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "pending", label: "Pending Approval", statuses: ["PENDING_APPROVAL"] },
  { key: "registration-open", label: "Registration Open", statuses: ["PUBLISHED", "REGISTRATION_OPEN"] },
  { key: "registration-closed", label: "Registration Closed", statuses: ["REGISTRATION_CLOSED"] },
  { key: "ongoing", label: "Ongoing", statuses: ["SELECTION_ONGOING"] },
  { key: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED", "REJECTED"] },
];

export default async function DrivesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // drive.view isn't held by Student (see lib/rbac/permissions.ts) — this
  // list page had no gate at all before this fix, same bug class as
  // drives/[id]/page.tsx: a student navigating here directly saw every
  // drive in the college including DRAFT/PENDING_APPROVAL ones that
  // opportunities/page.tsx (the student-facing equivalent) explicitly
  // keeps hidden, plus Create/Export/Import-CSV actions meant for staff.
  const canView = await hasPermission(session, "drive.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this page.</CardContent>
      </Card>
    );
  }

  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";
  const activeTabDef = TABS.find((t) => t.key === activeTab)!;
  const view = params.view === "calendar" ? "calendar" : "table";
  const defaultYm = currentYearMonth();
  const calYear = params.year ? Number(params.year) : defaultYm.year;
  const calMonth = params.month ? Number(params.month) : defaultYm.month;

  const where: Record<string, unknown> = {};
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { company: { name: { contains: params.q, mode: "insensitive" } } },
      { positions: { some: { title: { contains: params.q, mode: "insensitive" } } } },
    ];
  }
  if (params.status) where.status = params.status;
  else if (activeTabDef.statuses) where.status = { in: activeTabDef.statuses };
  if (params.companyId) where.companyId = params.companyId;
  if (params.locationCategory) where.locationCategory = params.locationCategory;
  if (params.courseId) where.eligibleCourses = { some: { courseId: params.courseId } };
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.sourceType) where.sourceType = params.sourceType;
  if (params.createdById) where.createdById = params.createdById;
  if (params.minShortlisted) where.shortlistedCount = { gte: Number(params.minShortlisted) };
  if (params.regClosesFrom || params.regClosesTo) {
    where.registrationClosesAt = {
      ...(params.regClosesFrom ? { gte: new Date(params.regClosesFrom) } : {}),
      ...(params.regClosesTo ? { lte: new Date(params.regClosesTo) } : {}),
    };
  }
  if (params.driveDateFrom || params.driveDateTo) {
    where.driveScheduledAt = {
      ...(params.driveDateFrom ? { gte: new Date(params.driveDateFrom) } : {}),
      ...(params.driveDateTo ? { lte: new Date(params.driveDateTo) } : {}),
    };
  }
  if (params.hasEligibilityRule === "1") where.eligibilityRules = { some: { isPublished: true } };
  if (params.hasInterviews === "1") where.rounds = { some: {} };
  if (params.hasOffers === "1") where.offers = { some: {} };
  if (params.positionType || params.minCtc || params.maxCtc) {
    where.positions = {
      some: {
        ...(params.positionType ? { positionType: params.positionType } : {}),
        ...(params.minCtc ? { maxCtc: { gte: Number(params.minCtc) } } : {}),
        ...(params.maxCtc ? { minCtc: { lte: Number(params.maxCtc) } } : {}),
      },
    };
  }
  const activeBatchId = await getActiveBatchId();
  if (activeBatchId) where.batchId = activeBatchId;

  const batchWhere = activeBatchId ? { batchId: activeBatchId } : {};

  const [driveResults, companies, courses, departments, staff, total, published, registrationOpen, ongoing, completed, offersCount] = await Promise.all([
    db.drive.findMany({
      where,
      include: { company: true, batch: { select: { year: true } }, positions: true, _count: { select: { applications: true, offers: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.company.findMany({ where: { partnerships: { some: { collegeId: session.collegeId } } }, orderBy: { name: "asc" } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { userType: "PLACEMENT_TEAM" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.drive.count({ where: batchWhere }),
    db.drive.count({ where: { ...batchWhere, status: "PUBLISHED" } }),
    db.drive.count({ where: { ...batchWhere, status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] } } }),
    db.drive.count({ where: { ...batchWhere, status: "SELECTION_ONGOING" } }),
    db.drive.count({ where: { ...batchWhere, status: "COMPLETED" } }),
    db.offer.count({ where: { drive: batchWhere } }),
  ]);

  // minApplications/minOffers threshold filters — these read off `_count`,
  // which Prisma's `where` can't compare numerically (only existence via
  // `some`/`none`), so they're applied as a post-fetch pass rather than in
  // the query itself. Every OTHER filter above already narrowed the
  // candidate set, so this is filtering an already-small page-sized list,
  // not the full table.
  const drives = driveResults
    .filter((d) => (params.minApplications ? d._count.applications >= Number(params.minApplications) : true))
    .filter((d) => (params.minOffers ? d._count.offers >= Number(params.minOffers) : true))
    .slice(0, 200);

  const activeFilterCount = Object.values(params).filter(Boolean).length;

  function hrefWith(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/drives?${qs}` : "/drives";
  }

  const rows: DriveRow[] = drives.map((d) => {
    const pos = d.positions[0];
    return {
      id: d.id,
      companyName: d.company.name,
      batchYear: d.batch.year,
      title: d.title,
      status: d.status,
      registrationClosesAt: d.registrationClosesAt ? d.registrationClosesAt.toISOString() : null,
      ctcLabel: pos?.minCtc || pos?.maxCtc ? `₹${((Number(pos.minCtc) || 0) / 100000).toFixed(1)}L – ₹${((Number(pos.maxCtc) || 0) / 100000).toFixed(1)}L` : "-",
      positionType: pos?.positionType.replaceAll("_", " ") ?? "-",
      driveTypeLabel: d.driveTypeLabel,
      source: d.sourceType === "SELF" ? "Self" : "Inbound",
      openings: d.expectedOpenings,
      eligibleCount: d.eligibleCount,
      applications: d._count.applications,
      approvedCount: d.approvedCount,
      shortlistedCount: d.shortlistedCount,
      offers: d._count.offers,
      isTemplate: d.isTemplate,
    };
  });

  const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  const exportHref = exportQs ? `/api/drives/export?${exportQs}` : "/api/drives/export";

  const calendarEvents: CalendarEvent[] = drives.flatMap((d) => {
    const evts: CalendarEvent[] = [];
    if (d.registrationClosesAt) evts.push({ driveId: d.id, title: d.title, companyName: d.company.name, date: d.registrationClosesAt, kind: "Registration closes" });
    if (d.driveScheduledAt) evts.push({ driveId: d.id, title: d.title, companyName: d.company.name, date: d.driveScheduledAt, kind: "Drive date" });
    if (d.selectionStartsAt) evts.push({ driveId: d.id, title: d.title, companyName: d.company.name, date: d.selectionStartsAt, kind: "Selection starts" });
    return evts;
  });

  const prevMonth = calMonth === 0 ? { year: calYear - 1, month: 11 } : { year: calYear, month: calMonth - 1 };
  const nextMonth = calMonth === 11 ? { year: calYear + 1, month: 0 } : { year: calYear, month: calMonth + 1 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Placement Drives</h1>
          <p className="text-muted-foreground text-sm">Manage and track placement drives from creation to completion.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<a href={exportHref} />}>
            <Upload className="size-4 rotate-180" /> Export
          </Button>
          <Button variant="outline" render={<Link href="/drives/import" />}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <CreateDriveMenu />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Briefcase} label="Total Drives" value={total} color="blue" />
        <StatCard icon={Rocket} label="Published" value={published} color="violet" />
        <StatCard icon={Users} label="Registration Open" value={registrationOpen} color="sky" />
        <StatCard icon={CheckCircle2} label="Ongoing" value={ongoing} color="amber" />
        <StatCard icon={CheckCircle2} label="Completed" value={completed} color="emerald" />
        <StatCard icon={FileCheck2} label="Offers" value={offersCount} color="teal" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="min-w-0 flex-1">
          {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <Input name="q" placeholder="Search drive, company, position…" defaultValue={params.q} />
        </form>
        <DrivesFilterPanel
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          courses={courses.map((c) => ({ id: c.id, name: c.name, specialization: c.specialization }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          staff={staff}
        />
        <DrivesSavedViewsDropdown />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={hrefWith({ tab: t.key === "all" ? undefined : t.key })}
              className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="mb-1 flex items-center gap-1 text-sm">
          <Link href={hrefWith({ view: undefined })} className={`rounded-md px-2 py-1 ${view === "table" ? "bg-accent font-medium" : "text-muted-foreground"}`}>Table View</Link>
          <Link href={hrefWith({ view: "calendar" })} className={`rounded-md px-2 py-1 ${view === "calendar" ? "bg-accent font-medium" : "text-muted-foreground"}`}>Calendar View</Link>
        </div>
      </div>

      {view === "calendar" ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-center gap-2">
              <Link href={hrefWith({ year: String(prevMonth.year), month: String(prevMonth.month) })} className="rounded-md border px-2 py-1 text-sm hover:bg-accent">←</Link>
              <Link href={hrefWith({ year: String(nextMonth.year), month: String(nextMonth.month) })} className="rounded-md border px-2 py-1 text-sm hover:bg-accent">→</Link>
              <Link href={hrefWith({ year: undefined, month: undefined })} className="text-muted-foreground text-sm hover:underline">Today</Link>
            </div>
            <DrivesCalendar year={calYear} month={calMonth} events={calendarEvents} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <p className="text-muted-foreground mb-3 text-xs">
              {drives.length} drive{drives.length === 1 ? "" : "s"}{activeFilterCount > 0 ? " matching filters" : " this batch"}.
            </p>
            <DrivesTable rows={rows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
