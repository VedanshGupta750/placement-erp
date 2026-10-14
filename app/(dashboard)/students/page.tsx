import Link from "next/link";
import { Upload, Info, X } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StudentsFilterPanel } from "@/components/students/students-filter-panel";
import { SavedViewsDropdown } from "@/components/students/saved-views-dropdown";
import { KpiCards } from "@/components/students/kpi-cards";
import { DepartmentDistributionChart } from "@/components/students/department-distribution-chart";
import { QuickActionsPanel } from "@/components/students/quick-actions-panel";
import { SmartAlertsPanel } from "@/components/students/smart-alerts-panel";
import { StudentsTable, type StudentRow } from "@/components/students/students-table";
import { AddStudentDialog } from "@/components/students/add-student-dialog";
import { AiQueryBar } from "@/components/students/ai-query-bar";
import { hasPermission } from "@/lib/rbac/guard";
import { getActiveBatchId } from "@/lib/batch-context";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { placedStudentWhere, notPlacedStudentWhere, PLACED_OFFER_STATUSES, effectivePlacementStatus } from "@/lib/students/placement";
import { getAttentionStudents } from "@/lib/dashboard/get-attention-students";

type SearchParams = {
  ids?: string;
  q?: string;
  courseId?: string;
  batchId?: string;
  departmentId?: string;
  minCgpa?: string;
  maxCgpa?: string;
  minTenth?: string;
  maxTenth?: string;
  minTwelfth?: string;
  maxTwelfth?: string;
  minDiploma?: string;
  maxDiploma?: string;
  maxBacklogs?: string;
  hasBacklogs?: string;
  hasHistoricalBacklogs?: string;
  eligible?: string;
  placementStatus?: string;
  interestedJobs?: string;
  interestedInternships?: string;
  notApplied?: string;
  missingResume?: string;
  needsAttention?: string;
  tab?: string;
};

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All Students" },
  { key: "eligible", label: "Eligible" },
  { key: "placed", label: "Placed" },
  { key: "not-placed", label: "Not Placed" },
  { key: "backlogs", label: "With Backlogs" },
  { key: "high-cgpa", label: "High CGPA" },
  { key: "assigned-to-me", label: "Assigned to Me" },
];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();

  // Students have no student.view grant (per the RBAC freeze matrix — a
  // student's own record is only ever reachable via /profile, never this
  // roster/directory), so without this gate any logged-in student could
  // browse every other student's full profile including CGPA/notes/
  // documents. Same "no access" pattern as the Events module.
  const canView = await hasPermission(session, "student.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to the student directory.</CardContent>
      </Card>
    );
  }

  const canCreate = await hasPermission(session, "student.create");
  // Bulk suspend needs student.edit; bulk delete needs student.delete,
  // which by default only TPO and College Admin hold.
  const canBulkEdit = (await hasPermission(session, "student.edit")) && (await hasPermission(session, "student.bulk_update"));
  const canDelete = await hasPermission(session, "student.delete");
  const db = getTenantDb(session.collegeId);

  // Kept separate from `where` (rather than spread into it) so a
  // Department Coordinator's own department filter selection can never
  // silently overwrite the row-level scope — they're AND-combined at query
  // time instead, so an out-of-scope filter selection just returns zero
  // rows rather than bypassing the restriction.
  const scopeWhere = await getStudentScopeWhere(db, session);

  const where: Record<string, unknown> = {};
  if (params.ids) {
    where.id = { in: params.ids.split(",").filter(Boolean) };
  }
  if (params.q) {
    where.OR = [
      { user: { name: { contains: params.q, mode: "insensitive" } } },
      { enrollmentNumber: { contains: params.q, mode: "insensitive" } },
      { user: { email: { contains: params.q, mode: "insensitive" } } },
      { user: { phone: { contains: params.q, mode: "insensitive" } } },
    ];
  }
  if (params.courseId) where.courseId = params.courseId;
  if (params.departmentId) where.departmentId = params.departmentId;
  const activeBatchId = await getActiveBatchId();
  const effectiveBatchId = params.batchId || activeBatchId;
  if (effectiveBatchId) where.batchId = effectiveBatchId;
  if (params.minCgpa || params.maxCgpa) {
    where.aggregate = {
      ...(params.minCgpa ? { gte: Number(params.minCgpa) } : {}),
      ...(params.maxCgpa ? { lte: Number(params.maxCgpa) } : {}),
    };
  }
  if (params.minTenth || params.maxTenth) {
    where.tenthScore = {
      ...(params.minTenth ? { gte: Number(params.minTenth) } : {}),
      ...(params.maxTenth ? { lte: Number(params.maxTenth) } : {}),
    };
  }
  if (params.minTwelfth || params.maxTwelfth) {
    where.twelfthScore = {
      ...(params.minTwelfth ? { gte: Number(params.minTwelfth) } : {}),
      ...(params.maxTwelfth ? { lte: Number(params.maxTwelfth) } : {}),
    };
  }
  if (params.minDiploma || params.maxDiploma) {
    where.diplomaScore = {
      ...(params.minDiploma ? { gte: Number(params.minDiploma) } : {}),
      ...(params.maxDiploma ? { lte: Number(params.maxDiploma) } : {}),
    };
  }
  if (params.maxBacklogs) where.liveBacklogs = { lte: Number(params.maxBacklogs) };
  if (params.hasBacklogs === "1") where.liveBacklogs = { gt: 0 };
  if (params.hasHistoricalBacklogs === "1") where.closedBacklogs = { gt: 0 };
  if (params.eligible === "1") where.eligibleForPlacements = true;
  // "PLACED" is derived from offers, not read from the column — see
  // lib/students/placement.ts for why the column can't be trusted for it.
  if (params.placementStatus === "PLACED") Object.assign(where, placedStudentWhere);
  else if (params.placementStatus) where.placementStatus = params.placementStatus;
  if (params.interestedJobs === "1") where.interestedInJobs = true;
  if (params.interestedInternships === "1") where.interestedInInternships = true;
  if (params.notApplied === "1") {
    where.eligibleForPlacements = true;
    where.applications = { none: {} };
  }
  if (params.missingResume === "1") where.resumes = { none: { isDefault: true } };
  if (params.needsAttention === "1") {
    const flagged = await getAttentionStudents(db, session.collegeId, Number.POSITIVE_INFINITY);
    where.id = { in: flagged.map((s) => s.id) };
  }

  // Preset saved-view tabs — each just widens `where` further, same pattern
  // as the Events list page's status tabs.
  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";
  if (activeTab === "eligible") where.eligibleForPlacements = true;
  if (activeTab === "placed") Object.assign(where, placedStudentWhere);
  if (activeTab === "not-placed") Object.assign(where, notPlacedStudentWhere);
  if (activeTab === "backlogs") where.liveBacklogs = { gt: 0 };
  if (activeTab === "high-cgpa") where.aggregate = { gte: 8 };
  if (activeTab === "assigned-to-me") where.assignedCoordinatorId = session.userId;

  // The active batch is the user's working scope (same tier as scopeWhere,
  // the RBAC department scope), not an ad-hoc filter like search/CGPA/tab —
  // so it must fold into every "totals" query below, not just the row list.
  const batchScopeWhere = effectiveBatchId ? { ...scopeWhere, batchId: effectiveBatchId } : scopeWhere;

  const [students, filteredTotal, total, eligibleCount, placedCount, avgCgpaAgg, withBacklogsCount, assignedToMeCount, courses, batches, departments, deptCounts] = await Promise.all([
    db.student.findMany({
      where: { AND: [scopeWhere, where] },
      include: {
        user: true,
        course: true,
        department: true,
        // Just enough to know whether a placing offer exists, so the row's
        // status reflects reality rather than the stale column.
        offers: { where: { status: { in: [...PLACED_OFFER_STATUSES] } }, select: { id: true }, take: 1 },
      },
      orderBy: { user: { name: "asc" } },
      take: 200,
    }),
    // Distinct from `total` below (which is intentionally scope-only, used
    // for the preset-tab counts) — this reflects the currently active
    // search/filter/tab combination, for the "X of Y shown" caption.
    db.student.count({ where: { AND: [scopeWhere, where] } }),
    db.student.count({ where: batchScopeWhere }),
    db.student.count({ where: { ...batchScopeWhere, eligibleForPlacements: true } }),
    db.student.count({ where: { ...batchScopeWhere, ...placedStudentWhere } }),
    db.student.aggregate({ where: batchScopeWhere, _avg: { aggregate: true } }),
    db.student.count({ where: { ...batchScopeWhere, liveBacklogs: { gt: 0 } } }),
    db.student.count({ where: { ...batchScopeWhere, assignedCoordinatorId: session.userId } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.batch.findMany({ orderBy: { year: "desc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.student.groupBy({ where: batchScopeWhere, by: ["departmentId"], _count: { _all: true } }),
  ]);

  const unplacedCount = total - placedCount;
  const deptNameById = new Map(departments.map((d: { id: string; name: string }) => [d.id, d.name]));
  const deptRows = deptCounts
    .map((d: { departmentId: string | null; _count: { _all: number } }) => ({
      label: d.departmentId ? (deptNameById.get(d.departmentId) ?? "Unknown") : "Unassigned",
      count: d._count._all,
    }))
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count);

  const tabCounts: Record<string, number> = {
    all: total,
    eligible: eligibleCount,
    placed: placedCount,
    "not-placed": unplacedCount,
    backlogs: withBacklogsCount,
    "high-cgpa": 0, // not worth a separate count query — omitted from the badge
    "assigned-to-me": assignedToMeCount,
  };

  function hrefWith(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/students?${qs}` : "/students";
  }

  const exportQs = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => !!entry[1])).toString();
  const exportHref = exportQs ? `/api/students/export?${exportQs}` : "/api/students/export";

  const linkFilterBanner =
    params.needsAttention === "1"
      ? "Showing students who need attention — missing resume, at risk with backlogs, low applications, or no activity."
      : params.notApplied === "1"
        ? "Showing eligible students who haven't applied to any drive."
        : params.missingResume === "1"
          ? "Showing students without a default resume."
          : null;

  const rows: StudentRow[] = students.map((s: {
    id: string;
    enrollmentNumber: string;
    user: { name: string; email: string; status: string };
    course: { name: string; specialization: string | null };
    aggregate: number | null;
    tenthScore: number | null;
    twelfthScore: number | null;
    liveBacklogs: number;
    eligibleForPlacements: boolean;
    placementStatus: string;
    offers: { id: string }[];
  }) => ({
    id: s.id,
    enrollmentNumber: s.enrollmentNumber,
    name: s.user.name,
    email: s.user.email,
    courseLabel: s.course.specialization ?? s.course.name,
    cgpa: s.aggregate,
    tenthScore: s.tenthScore,
    twelfthScore: s.twelfthScore,
    liveBacklogs: s.liveBacklogs,
    eligibleForPlacements: s.eligibleForPlacements,
    placementStatus: effectivePlacementStatus(s.placementStatus, s.offers.length > 0),
    accountStatus: s.user.status,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-muted-foreground text-sm">Batch roster, eligibility & placement status.</p>
        </div>
        <div className="flex">
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<a href={exportHref} />}>
            <Upload className="size-4 rotate-180" /> Export CSV
          </Button>
          <Button variant="outline" render={<Link href="/students/import" />}>
            <Upload className="size-4" /> Import CSV
          </Button>
          {canCreate && (
            <AddStudentDialog
              courses={courses.map((c: { id: string; name: string; specialization: string | null }) => ({ id: c.id, name: c.name, specialization: c.specialization }))}
              batches={batches.map((b: { id: string; year: number }) => ({ id: b.id, year: b.year }))}
              departments={departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))}
            />
          )}
          </div>
        </div>
      </div>

      {linkFilterBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Info className="size-4 shrink-0 text-primary" />
            {linkFilterBanner}
          </span>
          <Link href="/students" className="flex shrink-0 items-center gap-1 font-medium text-primary hover:underline">
            <X className="size-3.5" /> Clear filter
          </Link>
        </div>
      )}

      <KpiCards
        total={total}
        eligible={eligibleCount}
        placed={placedCount}
        avgCgpa={avgCgpaAgg._avg.aggregate}
        withBacklogs={withBacklogsCount}
        unplaced={unplacedCount}
      />

      <AiQueryBar />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="-mx-4 flex items-center gap-1 overflow-x-auto border-b px-4 pb-1 overscroll-x-contain [scrollbar-width:thin] sm:mx-0 sm:px-0">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={hrefWith({ tab: t.key === "all" ? undefined : t.key })}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">{tabCounts[t.key]}</span>
                )}
              </Link>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <form className="w-full min-w-0 sm:flex-1">
                  {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
                  <Input name="q" placeholder="Search by name, enrollment number, or email…" defaultValue={params.q} />
                </form>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:shrink-0 sm:pb-0">
                  <StudentsFilterPanel
                    courses={courses.map((c: { id: string; name: string; specialization: string | null }) => ({ id: c.id, name: c.name, specialization: c.specialization }))}
                    batches={batches.map((b: { id: string; year: number }) => ({ id: b.id, year: b.year }))}
                    departments={departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))}
                  />
                  <SavedViewsDropdown />
                </div>
              </div>
              <p className="text-muted-foreground mb-3 text-xs">{rows.length} of {filteredTotal} students shown</p>
              <StudentsTable rows={rows} canEdit={canBulkEdit} canDelete={canDelete} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <SmartAlertsPanel batchId={effectiveBatchId} />
          <DepartmentDistributionChart rows={deptRows} />
          <QuickActionsPanel />
        </div>
      </div>
    </div>
  );
}
