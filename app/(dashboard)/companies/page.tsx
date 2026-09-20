import Link from "next/link";
import { AlertTriangle, Building2, TrendingUp, Briefcase, FileCheck2, Percent, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/stat-card";
import { CompaniesFilterPanel } from "@/components/companies/companies-filter-panel";
import { CompanyCard, type CompanyCardData } from "@/components/companies/company-card";
import { CompaniesTable } from "@/components/companies/companies-table";
import { AddCompanyDialog } from "@/components/companies/add-company-dialog";
import { CompaniesAiQueryBar } from "@/components/companies/ai-query-bar";
import { hasPermission } from "@/lib/rbac/guard";
import { getCompanyListStats, getCompanyPackageAnalytics, computeDormantAlertCount } from "@/lib/companies/stats";
import { ACTIVE_DRIVE_STATUSES } from "@/lib/contacts/stats";

type SearchParams = {
  ids?: string;
  q?: string;
  status?: string;
  industryType?: string;
  hiringType?: string;
  tab?: string;
  view?: string;
};

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All Companies" },
  { key: "active", label: "Active" },
  { key: "hiring", label: "Hiring This Season" },
  { key: "dormant", label: "Dormant" },
  { key: "prospects", label: "Prospects" },
];

const DORMANT_MONTHS_THRESHOLD = 12;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const canCreate = await hasPermission(session, "company.create");
  const view = params.view === "table" ? "table" : "grid";
  const activeTab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";

  const where: Record<string, unknown> = {};
  if (params.ids) where.companyId = { in: params.ids.split(",").filter(Boolean) };
  if (params.status) where.status = params.status;
  if (activeTab === "active") where.status = { in: ["ACTIVE", "PARTNER"] };
  if (activeTab === "dormant") where.status = "DORMANT";
  if (activeTab === "prospects") where.status = "PENDING";

  const companyWhere: Record<string, unknown> = {};
  if (params.industryType) companyWhere.industryType = params.industryType;
  if (params.hiringType) companyWhere.hiringType = params.hiringType;
  if (params.q) {
    companyWhere.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { industryType: { contains: params.q, mode: "insensitive" } },
      { contacts: { some: { name: { contains: params.q, mode: "insensitive" } } } },
    ];
  }
  if (Object.keys(companyWhere).length > 0) where.company = companyWhere;

  // Each company's drives/applications/offers below are real hiring
  // activity, tied to whichever batch ran that drive — so the active batch
  // scope applies here the same way it does on Students/Applications/Offers.
  const activeBatchId = await getActiveBatchId();

  const [partnerships, listStats, industriesRaw] = await Promise.all([
    db.collegePartnership.findMany({
      where,
      include: {
        company: {
          include: {
            drives: {
              where: { collegeId: session.collegeId, ...(activeBatchId ? { batchId: activeBatchId } : {}) },
              include: { _count: { select: { applications: true, offers: true } } },
            },
          },
        },
      },
      orderBy: { connectedAt: "desc" },
    }),
    getCompanyListStats(db, activeBatchId),
    prisma.company.findMany({ where: { industryType: { not: null } }, select: { industryType: true }, distinct: ["industryType"] }),
  ]);

  const industries = industriesRaw.map((i: { industryType: string | null }) => i.industryType!).filter(Boolean).sort();

  // "Hiring This Season" — has at least one drive in an active status.
  const filteredPartnerships =
    activeTab === "hiring"
      ? partnerships.filter((p) => p.company.drives.some((d: { status: string }) => ACTIVE_DRIVE_STATUSES.includes(d.status as (typeof ACTIVE_DRIVE_STATUSES)[number])))
      : partnerships;

  const dormantAlertCount = computeDormantAlertCount(partnerships, DORMANT_MONTHS_THRESHOLD);

  // Companies get offer counts via each drive's _count — CTC needs a real
  // aggregate, done per-visible-company (bounded list, cheap enough).
  const packageStats = await Promise.all(filteredPartnerships.map((p) => getCompanyPackageAnalytics(db, p.company.id, activeBatchId)));

  const cards: CompanyCardData[] = filteredPartnerships.map((p, i) => {
    const drives = p.company.drives;
    const applications = drives.reduce((s: number, d: { _count: { applications: number } }) => s + d._count.applications, 0);
    const offers = drives.reduce((s: number, d: { _count: { offers: number } }) => s + d._count.offers, 0);
    const avgRaw = packageStats[i].avgCtc;
    const lastActivityAt = drives.reduce<Date | null>((latest, d: { createdAt: Date }) => (!latest || d.createdAt > latest ? d.createdAt : latest), null);
    return {
      id: p.company.id,
      name: p.company.name,
      logoUrl: p.company.logoUrl,
      industryType: p.company.industryType,
      status: p.status,
      drives: drives.length,
      applications,
      offers,
      avgCtc: avgRaw != null ? Math.round((avgRaw / 100000) * 10) / 10 : null,
      placementRate: applications > 0 ? Math.round((offers / applications) * 1000) / 10 : null,
      lastActivityAt,
    };
  });

  function hrefWith(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/companies?${qs}` : "/companies";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm">Manage recruiter partnerships, hiring activity and placement outcomes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<a href="/api/companies/export" />}>
            <Upload className="size-4 rotate-180" /> Export CSV
          </Button>
          {canCreate && (
            <Button variant="outline" render={<Link href="/companies/import" />}>
              <Upload className="size-4" /> Import CSV
            </Button>
          )}
          {canCreate && <AddCompanyDialog />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Partner Companies" value={listStats.totalPartnerships} color="blue" />
        <StatCard icon={TrendingUp} label="Active Hiring" value={listStats.activeHiring} color="violet" />
        <StatCard icon={Briefcase} label="Total Drives" value={listStats.totalDrives} color="sky" />
        <StatCard icon={FileCheck2} label="Offers Generated" value={listStats.offersGenerated} color="emerald" />
        <StatCard icon={Percent} label="Placement Conversion" value={`${listStats.placementConversion}%`} color="amber" />
      </div>

      <CompaniesAiQueryBar />

      {dormantAlertCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{dormantAlertCount} partner {dormantAlertCount === 1 ? "company hasn't" : "companies haven't"} hired in the last {DORMANT_MONTHS_THRESHOLD} months.</span>
            </div>
            <Link href={hrefWith({ tab: "dormant" })} className="font-medium text-amber-800 hover:underline dark:text-amber-400">
              View Companies
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form className="min-w-0 flex-1">
          {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <Input name="q" placeholder="Search companies, recruiters, industry…" defaultValue={params.q} />
        </form>
        <CompaniesFilterPanel industries={industries} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={hrefWith({ tab: t.key === "all" ? undefined : t.key })}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="mb-1 flex items-center gap-1 text-sm">
          <Link href={hrefWith({ view: undefined })} className={`rounded-md px-2 py-1 ${view === "grid" ? "bg-accent font-medium" : "text-muted-foreground"}`}>Grid</Link>
          <Link href={hrefWith({ view: "table" })} className={`rounded-md px-2 py-1 ${view === "table" ? "bg-accent font-medium" : "text-muted-foreground"}`}>Table</Link>
        </div>
      </div>

      {view === "table" ? (
        <CompaniesTable companies={cards} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => <CompanyCard key={c.id} company={c} />)}
          {cards.length === 0 && (
            <p className="text-muted-foreground col-span-full py-8 text-center text-sm">No companies match these filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
