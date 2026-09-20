import Link from "next/link";
import { FileCheck2, FileText, CheckCircle2, XCircle, Clock3, Send } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { OfferActions } from "@/components/offers/offer-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { OffersFilterPanel } from "@/components/offers/offers-filter-panel";
import { OffersTable, type OfferRow } from "@/components/offers/offers-table";
import { ApplicationFunnel } from "@/components/applications/application-funnel";
import { OfferDepartmentPanel } from "@/components/offers/offer-department-panel";
import { getOfferListStats, getOfferFunnel, getOfferDepartmentBreakdown } from "@/lib/offers/stats";
import { cn } from "@/lib/utils";

type SearchParams = {
  q?: string;
  driveId?: string;
  status?: string;
  offerType?: string;
  departmentId?: string;
  minCtc?: string;
  maxCtc?: string;
  offeredFrom?: string;
  offeredTo?: string;
  tab?: string;
  // Legacy params the sidebar's "Internship Offers"/"Joining" shortcuts
  // still link to (components/dashboard/sidebar-nav.tsx), predating this
  // page's tab/offerType-based scheme — handled below rather than touching
  // the shared nav component. "joining" isn't a real OfferStatus value, so
  // treating `status` as a literal enum for it crashed Prisma outright.
  type?: string;
};

const TABS: { key: string; label: string; statuses?: string[] }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "issued", label: "Awaiting response", statuses: ["ISSUED"] },
  { key: "accepted", label: "Accepted", statuses: ["ACCEPTED"] },
  { key: "joined", label: "Joined", statuses: ["JOINING_PENDING", "JOINED"] },
  { key: "declined", label: "Declined / Withdrawn", statuses: ["DECLINED", "DID_NOT_JOIN", "WITHDRAWN"] },
];

export default async function OffersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
        { drive: { title: { contains: params.q, mode: "insensitive" } } },
        { drive: { company: { name: { contains: params.q, mode: "insensitive" } } } },
      ];
    }
    if (params.driveId) where.driveId = params.driveId;
    if (params.status === "joining") where.status = { in: ["JOINING_PENDING", "JOINED"] };
    else if (params.status) where.status = params.status;
    else if (activeTabDef.statuses) where.status = { in: activeTabDef.statuses };
    if (params.type === "internship") where.offerType = "INTERNSHIP";
    else if (params.offerType) where.offerType = params.offerType;
    if (params.departmentId) where.student = { ...(where.student as object), departmentId: params.departmentId };
    if (params.minCtc || params.maxCtc) {
      where.totalCompensation = {
        ...(params.minCtc ? { gte: Number(params.minCtc) } : {}),
        ...(params.maxCtc ? { lte: Number(params.maxCtc) } : {}),
      };
    }
    if (params.offeredFrom || params.offeredTo) {
      where.offerDate = {
        ...(params.offeredFrom ? { gte: new Date(params.offeredFrom) } : {}),
        ...(params.offeredTo ? { lte: new Date(`${params.offeredTo}T23:59:59`) } : {}),
      };
    }

    // The active batch is the working scope, so it folds into the base
    // `where` alongside the other filters rather than being applied only to
    // the row list.
    const activeBatchId = await getActiveBatchId();
    if (activeBatchId) where.student = { ...(where.student as object), batchId: activeBatchId };

    const [offers, stats, funnel, deptBreakdown, drives, departments] = await Promise.all([
      db.offer.findMany({
        where,
        include: { student: { include: { user: true } }, drive: { include: { company: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      getOfferListStats(db, where),
      getOfferFunnel(db, where),
      getOfferDepartmentBreakdown(db, where),
      db.drive.findMany({ where: activeBatchId ? { batchId: activeBatchId } : {}, select: { id: true, title: true, company: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.department.findMany({ orderBy: { name: "asc" } }),
    ]);

    const activeFilterCount = Object.values(params).filter(Boolean).length;

    function hrefWith(overrides: Record<string, string | undefined>) {
      const next = new URLSearchParams();
      const merged = { ...params, ...overrides };
      for (const [key, value] of Object.entries(merged)) {
        if (value) next.set(key, value);
      }
      const qs = next.toString();
      return qs ? `/offers?${qs}` : "/offers";
    }

    const rows: OfferRow[] = offers.map((o) => ({
      id: o.id,
      enrollmentNumber: o.student.enrollmentNumber,
      studentName: o.student.user.name,
      studentId: o.studentId,
      companyName: o.drive.company.name,
      driveTitle: o.drive.title,
      driveId: o.driveId,
      offerType: o.offerType,
      totalCompensation: o.totalCompensation.toString(),
      offerDate: o.offerDate?.toISOString() ?? null,
      joiningDate: o.joiningDate?.toISOString() ?? null,
      status: o.status,
    }));

    const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
    const exportHref = exportQs ? `/api/offers/export?${exportQs}` : "/api/offers/export";

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Offers</h1>
            <p className="text-muted-foreground text-sm">Track every offer from draft through joining.</p>
          </div>
          <Button variant="outline" render={<a href={exportHref} />}>
            <FileText className="size-4" /> Export
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard icon={FileCheck2} label="Total Offers" value={stats.total} color="blue" />
          <StatCard icon={Send} label="Awaiting response" value={stats.issued} color="amber" />
          <StatCard icon={CheckCircle2} label="Accepted" value={stats.accepted} color="emerald" />
          <StatCard icon={XCircle} label="Declined" value={stats.declined} color="rose" />
          <StatCard icon={Clock3} label="Joined" value={stats.joined} color="teal" />
          <StatCard icon={FileCheck2} label="Avg Package" value={stats.avgPackage ? `₹${(stats.avgPackage / 100000).toFixed(1)}L` : "-"} color="violet" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <form className="min-w-0 flex-1">
                {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
                <Input name="q" placeholder="Search student name, enrollment number, company, drive…" defaultValue={params.q} />
              </form>
              <OffersFilterPanel
                drives={drives.map((d) => ({ id: d.id, title: d.title, companyName: d.company.name }))}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
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
                  {offers.length} offer{offers.length === 1 ? "" : "s"}{activeFilterCount > 0 ? " matching filters" : ""} shown of {stats.total} total.
                </p>
                <OffersTable rows={rows} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <ApplicationFunnel stages={funnel.stages} />
            <OfferDepartmentPanel rows={deptBreakdown} />
          </div>
        </div>
      </div>
    );
  }

  const student = await db.student.findUnique({ where: { userId: session.userId }, select: { id: true } });

  const offers = student
    ? await db.offer.findMany({
        where: { studentId: student.id },
        include: { drive: { include: { company: true } }, position: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My offers</h1>
        <p className="text-muted-foreground text-sm">{offers.length} offer{offers.length === 1 ? "" : "s"} received.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {offers.map((o) => (
          <Card key={o.id}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{o.drive.company.name}</div>
                  <div className="text-muted-foreground text-sm">
                    {o.drive.title}
                    {o.position ? ` · ${o.position.title}` : ""}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Total compensation</div>
                  <div className="font-semibold tabular-nums">₹{(Number(o.totalCompensation) / 100000).toFixed(1)}L</div>
                </div>
                {o.fixedCompensation !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Fixed</div>
                    <div className="font-medium tabular-nums">₹{(Number(o.fixedCompensation) / 100000).toFixed(1)}L</div>
                  </div>
                )}
                {o.variableCompensation !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Variable</div>
                    <div className="font-medium tabular-nums">₹{(Number(o.variableCompensation) / 100000).toFixed(1)}L</div>
                  </div>
                )}
                {o.stipend !== null && (
                  <div>
                    <div className="text-muted-foreground text-xs">Stipend</div>
                    <div className="font-medium tabular-nums">₹{Number(o.stipend).toLocaleString("en-IN")}/mo</div>
                  </div>
                )}
                {o.joiningDate && (
                  <div>
                    <div className="text-muted-foreground text-xs">Joining date</div>
                    <div className="font-medium">{new Date(o.joiningDate).toLocaleDateString("en-IN")}</div>
                  </div>
                )}
                {o.offerDate && (
                  <div>
                    <div className="text-muted-foreground text-xs">Offer date</div>
                    <div className="font-medium">{new Date(o.offerDate).toLocaleDateString("en-IN")}</div>
                  </div>
                )}
              </div>

              {o.status === "ISSUED" && (
                <div className="mt-1">
                  <OfferActions id={o.id} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {offers.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <FileCheck2 className="size-6" />
              No offers yet — keep applying!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
