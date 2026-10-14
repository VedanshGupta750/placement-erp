import Link from "next/link";
import { FileText, Upload, Users, CheckCircle2, Star, Clock3, FileCheck2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { WithdrawButton } from "@/components/applications/withdraw-button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/stat-card";
import { ApplicationsFilterPanel } from "@/components/applications/applications-filter-panel";
import { ApplicationsSavedViewsDropdown } from "@/components/applications/applications-saved-views-dropdown";
import { ApplicationsTable, type ApplicationRow } from "@/components/applications/applications-table";
import { ApplicationsOverviewChart } from "@/components/applications/applications-overview-chart";
import { DriveWisePanel } from "@/components/applications/drive-wise-panel";
import { AddApplicationDialog } from "@/components/applications/add-application-dialog";
import { getApplicationListStats, getDriveWiseApplicationCounts, getApplicationFunnel } from "@/lib/applications/stats";
import { placedStudentWhere, notPlacedStudentWhere, PLACED_OFFER_STATUSES, andStudentWhere } from "@/lib/students/placement";
import { ApplicationFunnel } from "@/components/applications/application-funnel";
import { ApplicationFlagsPanel } from "@/components/applications/application-flags-panel";
import { getApplicationFlags } from "@/lib/applications/flags";

const WITHDRAWABLE = new Set(["REGISTERED", "APPLIED", "COLLEGE_APPROVED", "SCREENING"]);

type SearchParams = {
  q?: string;
  driveId?: string;
  companyId?: string;
  status?: string;
  departmentId?: string;
  courseId?: string;
  appliedFrom?: string;
  appliedTo?: string;
  minBacklogs?: string;
  maxBacklogs?: string;
  minCgpa?: string;
  maxCgpa?: string;
  minTenth?: string;
  minTwelfth?: string;
  placement?: string;
  excludePlaced?: string;
  priority?: string;
  hasOffer?: string;
  tab?: string;
};

const TABS: { key: string; label: string; statuses?: string[] }[] = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied", statuses: ["APPLIED", "COLLEGE_APPROVED", "SCREENING"] },
  { key: "shortlisted", label: "Shortlisted", statuses: ["SHORTLISTED"] },
  { key: "in-progress", label: "In Progress", statuses: ["ROUND_IN_PROGRESS"] },
  { key: "selected", label: "Selected", statuses: ["SELECTED"] },
  { key: "rejected", label: "Rejected", statuses: ["REJECTED"] },
  { key: "withdrawn", label: "Withdrawn", statuses: ["WITHDRAWN"] },
];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { userType: true } });

  if (user.userType !== "STUDENT") {
    const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";
    const activeTabDef = TABS.find((t) => t.key === activeTab)!;

    const where: Record<string, unknown> = {};
    if (params.q) {
      where.OR = [
        { student: { user: { name: { contains: params.q, mode: "insensitive" } } } },
        { student: { enrollmentNumber: { contains: params.q, mode: "insensitive" } } },
        { student: { user: { email: { contains: params.q, mode: "insensitive" } } } },
        { drive: { title: { contains: params.q, mode: "insensitive" } } },
        { drive: { company: { name: { contains: params.q, mode: "insensitive" } } } },
        { position: { title: { contains: params.q, mode: "insensitive" } } },
      ];
    }
    // These five accept several values at once (the filter panel renders
    // them as checkbox lists), passed as a comma-joined query parameter.
    // A single value still produces a one-element `in`, which Prisma treats
    // exactly like equality.
    const many = (v: string | undefined) => (v ? v.split(",").filter(Boolean) : []);
    const driveIds = many(params.driveId);
    const companyIds = many(params.companyId);
    const statuses = many(params.status);
    const departmentIds = many(params.departmentId);
    const courseIds = many(params.courseId);

    if (driveIds.length) where.driveId = { in: driveIds };
    if (statuses.length) where.status = { in: statuses };
    else if (activeTabDef.statuses) where.status = { in: activeTabDef.statuses };
    if (departmentIds.length) where.student = { ...(where.student as object), departmentId: { in: departmentIds } };
    if (courseIds.length) where.student = { ...(where.student as object), courseId: { in: courseIds } };
    if (params.minBacklogs || params.maxBacklogs) {
      where.student = {
        ...(where.student as object),
        liveBacklogs: {
          ...(params.minBacklogs ? { gte: Number(params.minBacklogs) } : {}),
          ...(params.maxBacklogs ? { lte: Number(params.maxBacklogs) } : {}),
        },
      };
    }
    if (params.appliedFrom || params.appliedTo) {
      where.appliedAt = {
        ...(params.appliedFrom ? { gte: new Date(params.appliedFrom) } : {}),
        ...(params.appliedTo ? { lte: new Date(`${params.appliedTo}T23:59:59`) } : {}),
      };
    }
    if (companyIds.length) where.drive = { ...(where.drive as object), companyId: { in: companyIds } };
    if (params.minCgpa || params.maxCgpa) {
      where.student = {
        ...(where.student as object),
        aggregate: {
          ...(params.minCgpa ? { gte: Number(params.minCgpa) } : {}),
          ...(params.maxCgpa ? { lte: Number(params.maxCgpa) } : {}),
        },
      };
    }
    if (params.minTenth) {
      where.student = { ...(where.student as object), tenthScore: { gte: Number(params.minTenth) } };
    }
    if (params.minTwelfth) {
      where.student = { ...(where.student as object), twelfthScore: { gte: Number(params.minTwelfth) } };
    }
    // "Placed" is always derived from a placing offer, never read from
    // Student.placementStatus — see lib/students/placement.ts for why that
    // column can't be trusted on its own. `excludePlaced` is the explicit
    // one-click version of placement=unplaced, kept separate so a TPO can
    // switch it on without losing whatever placement filter they'd set.
    if (params.placement === "placed") {
      where.student = andStudentWhere({ ...(where.student as object) }, placedStudentWhere);
    } else if (params.placement === "unplaced" || params.excludePlaced === "1") {
      where.student = andStudentWhere({ ...(where.student as object) }, notPlacedStudentWhere);
    }
    if (params.priority) where.priority = params.priority;
    if (params.hasOffer === "1") where.offer = { isNot: null };

    // The active batch is the working scope (same tier as a department/RBAC
    // scope), so it folds into the base `where` alongside the other filters
    // rather than being applied only to the row list.
    const activeBatchId = await getActiveBatchId();
    if (activeBatchId) where.student = { ...(where.student as object), batchId: activeBatchId };

    // Everything except the status/tab constraint — see the note on the
    // stats calls below for why that distinction matters.
    const statusAgnosticWhere = { ...where };
    delete statusAgnosticWhere.status;

    const [applications, stats, driveWise, funnel, flags, drives, departments, courses, companies] = await Promise.all([
      db.application.findMany({
        where,
        include: { student: { include: { user: true, course: true } }, drive: { include: { company: true } }, position: true, resume: { select: { file: { select: { dataUrl: true, originalName: true } } } } },
        orderBy: { appliedAt: "desc" },
        take: 200,
      }),
      // The summary cards and the funnel are a BREAKDOWN of the filtered
      // population, so they get the filters WITHOUT the status constraint.
      // Passing the full `where` made them contradict themselves: each card
      // overrides `status` for its own bucket, so on the Shortlisted tab the
      // header read "Total Applications 0" directly above "In Progress 2".
      // Total now means "applications matching your filters", and each card
      // is a real share of it.
      getApplicationListStats(db, statusAgnosticWhere),
      getDriveWiseApplicationCounts(db, statusAgnosticWhere, 5),
      getApplicationFunnel(db, statusAgnosticWhere),
      getApplicationFlags(db, statusAgnosticWhere),
      db.drive.findMany({ where: activeBatchId ? { batchId: activeBatchId } : {}, select: { id: true, title: true, company: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.department.findMany({ orderBy: { name: "asc" } }),
      db.course.findMany({ orderBy: { name: "asc" } }),
      // Companies that actually run drives for this college — a flat
      // company list would offer options that can never match anything.
      db.collegePartnership.findMany({ select: { company: { select: { id: true, name: true } } }, orderBy: { company: { name: "asc" } } }),
    ]);

    const activeFilterCount = Object.values(params).filter(Boolean).length;

    function hrefWith(overrides: Record<string, string | undefined>) {
      const next = new URLSearchParams();
      const merged = { ...params, ...overrides };
      for (const [key, value] of Object.entries(merged)) {
        if (value) next.set(key, value);
      }
      const qs = next.toString();
      return qs ? `/applications?${qs}` : "/applications";
    }

    // Which of these applicants already hold a placing offer, and where.
    // Surfaced as a badge rather than silently filtered out: a placed
    // student applying elsewhere is usually a policy question the TPO wants
    // to SEE, not one the list should quietly hide. The explicit
    // "Exclude already-placed" filter is there for when they do want it gone.
    const placingOffers = await db.offer.findMany({
      where: {
        studentId: { in: applications.map((a) => a.studentId) },
        status: { in: [...PLACED_OFFER_STATUSES] },
      },
      select: { studentId: true, drive: { select: { company: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    const placedCompanyByStudent = new Map<string, string>();
    for (const o of placingOffers) {
      if (!placedCompanyByStudent.has(o.studentId)) placedCompanyByStudent.set(o.studentId, o.drive.company.name);
    }

    const rows: ApplicationRow[] = applications.map((a) => ({
      id: a.id,
      enrollmentNumber: a.student.enrollmentNumber,
      studentName: a.student.user.name,
      studentId: a.studentId,
      courseLabel: a.student.course.specialization ?? a.student.course.name,
      liveBacklogs: a.student.liveBacklogs,
      cgpa: a.student.aggregate,
      resumeUrl: a.resume?.file?.dataUrl ?? null,
      resumeFileName: a.resume?.file?.originalName ?? null,
      placedAtCompany: placedCompanyByStudent.get(a.studentId) ?? null,
      driveTitle: a.drive.title,
      driveId: a.driveId,
      companyName: a.drive.company.name,
      matchScore: a.matchScore,
      appliedAt: a.appliedAt.toISOString(),
      status: a.status,
      priority: a.priority,
    }));

    const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
    const exportHref = exportQs ? `/api/applications/export?${exportQs}` : "/api/applications/export";
    const maxDriveCount = Math.max(1, ...driveWise.rows.map((r: { count: number }) => r.count));

    const [appliedCount, rejectedCount, withdrawnCount] = await Promise.all([
      db.application.count({ where: { ...where, status: { in: ["APPLIED", "COLLEGE_APPROVED", "SCREENING"] } } }),
      db.application.count({ where: { ...where, status: "REJECTED" } }),
      db.application.count({ where: { ...where, status: "WITHDRAWN" } }),
    ]);
    const overviewSegments = [
      { label: "Applied", count: appliedCount },
      { label: "Shortlisted", count: stats.shortlisted },
      { label: "In Progress", count: stats.inProgress },
      { label: "Selected", count: stats.selected },
      { label: "Rejected", count: rejectedCount },
      { label: "Withdrawn", count: withdrawnCount },
    ];
    const overviewTotal = overviewSegments.reduce((s, seg) => s + seg.count, 0);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
            <p className="text-muted-foreground text-sm">Track every student application across placement drives from application to final joining.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<a href={exportHref} />}>
              <Upload className="size-4 rotate-180" /> Export
            </Button>
            <Button variant="outline" render={<Link href="/applications/import" />}>
              <Upload className="size-4" /> Import CSV
            </Button>
            <AddApplicationDialog />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard icon={FileText} label="Total Applications" value={stats.total} color="blue" />
          <StatCard icon={Users} label="Unique Students" value={stats.uniqueStudents} color="sky" />
          <StatCard icon={Star} label="Shortlisted" value={stats.shortlisted} color="violet" />
          <StatCard icon={CheckCircle2} label="Selected" value={stats.selected} color="emerald" />
          <StatCard icon={Clock3} label="In Progress" value={stats.inProgress} color="amber" />
          <StatCard icon={FileCheck2} label="Offers" value={stats.withOffer} color="teal" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <form className="min-w-0 flex-1">
                {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
                <Input name="q" placeholder="Search student name, enrollment number, email, company, drive…" defaultValue={params.q} />
              </form>
              <ApplicationsFilterPanel
                drives={drives.map((d) => ({ id: d.id, title: d.title, companyName: d.company.name }))}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                courses={courses.map((c) => ({ id: c.id, name: c.name, specialization: c.specialization }))}
                companies={companies.map((p) => ({ id: p.company.id, name: p.company.name }))}
              />
              <ApplicationsSavedViewsDropdown />
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b">
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

            <Card>
              <CardContent className="overflow-x-auto pt-6">
                {/* Names the status tab explicitly. "0 of 4" with no
                    explanation was the confusing part: the filters matched
                    4 applications, none of which were in the open tab, and
                    nothing on screen said so. */}
                <p className="text-muted-foreground mb-3 text-xs">
                  {applications.length} application{applications.length === 1 ? "" : "s"} shown
                  {activeTab !== "all" ? ` in ${activeTabDef.label}` : ""} of {stats.total}
                  {activeFilterCount > 0 ? " matching your filters" : " total"}.
                  {applications.length === 0 && stats.total > 0 && activeTab !== "all" && (
                    <>
                      {" "}
                      <Link href={hrefWith({ tab: undefined })} className="text-primary hover:underline">
                        Show all statuses
                      </Link>
                    </>
                  )}
                </p>
                <ApplicationsTable rows={rows} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <ApplicationsOverviewChart total={overviewTotal} segments={overviewSegments} />
            <ApplicationFunnel stages={funnel.stages} />
            <ApplicationFlagsPanel flags={flags} />
            <DriveWisePanel rows={driveWise.rows} maxCount={maxDriveCount} />
          </div>
        </div>
      </div>
    );
  }

  const student = await db.student.findUnique({ where: { userId: session.userId }, select: { id: true } });

  const applications = student
    ? await db.application.findMany({
        where: { studentId: student.id },
        include: { drive: { include: { company: true } }, position: true },
        orderBy: { appliedAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My applications</h1>
        <p className="text-muted-foreground text-sm">{applications.length} application{applications.length === 1 ? "" : "s"} submitted.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y pt-6">
          {applications.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/opportunities/${a.driveId}`} className="font-medium hover:underline">
                  {a.drive.title}
                </Link>
                <div className="text-muted-foreground text-xs">
                  {a.drive.company.name} · {a.position.title}
                  {a.matchScore !== null ? ` · ${a.matchScore}% skill match` : ""}
                </div>
                <div className="text-muted-foreground text-xs">Applied {new Date(a.appliedAt).toLocaleDateString("en-IN")}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                {WITHDRAWABLE.has(a.status) && <WithdrawButton id={a.id} />}
              </div>
            </div>
          ))}

          {applications.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <FileText className="size-6" />
              You haven&apos;t applied to any drives yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
