import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCompanyFunnel, getCompanyPackageAnalytics } from "@/lib/companies/stats";
import { hasPermission } from "@/lib/rbac/guard";

// Select 2-5 companies via ?ids=a,b,c and see a side-by-side hiring-metric
// table — same pattern as /students/compare.
export default async function CompareCompaniesPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // company.view isn't held by Student — same gap/fix as companies/[id].
  const canView = await hasPermission(session, "company.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this page.</CardContent>
      </Card>
    );
  }

  const companyIds = (ids ?? "").split(",").filter(Boolean).slice(0, 5);

  const [companies, partnerships] = await Promise.all([
    prisma.company.findMany({ where: { id: { in: companyIds } }, include: { drives: { where: { collegeId: session.collegeId }, select: { id: true } } } }),
    db.collegePartnership.findMany({ where: { companyId: { in: companyIds } } }),
  ]);
  const ordered = companyIds.map((id) => companies.find((c) => c.id === id)).filter(Boolean) as typeof companies;

  const funnels = await Promise.all(ordered.map((c) => getCompanyFunnel(db, c.id)));
  const packages = await Promise.all(ordered.map((c) => getCompanyPackageAnalytics(db, c.id)));
  const statusById = new Map(partnerships.map((p) => [p.companyId, p.status]));

  const rows: { label: string; values: (string | number)[] }[] = [
    { label: "Status", values: ordered.map((c) => statusById.get(c.id) ?? "—") },
    { label: "Drives", values: ordered.map((c) => c.drives.length) },
    { label: "Applications", values: funnels.map((f) => f.applications) },
    { label: "Interviews", values: funnels.map((f) => f.interviewed) },
    { label: "Offers", values: funnels.map((f) => f.offers) },
    { label: "Joined", values: funnels.map((f) => f.joined) },
    { label: "Offer Rate", values: funnels.map((f) => `${f.offerRate}%`) },
    { label: "Joining Rate", values: funnels.map((f) => `${f.joiningRate}%`) },
    { label: "Avg CTC", values: packages.map((p) => (p.avgCtc != null ? `₹${(p.avgCtc / 100000).toFixed(1)}L` : "—")) },
    { label: "Max CTC", values: packages.map((p) => (p.maxCtc != null ? `₹${(p.maxCtc / 100000).toFixed(1)}L` : "—")) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/companies" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to companies
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare Companies</h1>
        <p className="text-muted-foreground text-sm">Side-by-side comparison of {ordered.length} compan{ordered.length === 1 ? "y" : "ies"}.</p>
      </div>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No companies selected. Go back to the list, select 2-5 companies, then use Compare.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  {ordered.map((c) => (
                    <TableHead key={c.id}>
                      <Link href={`/companies/${c.id}`} className="hover:underline">{c.name}</Link>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell className="text-muted-foreground font-medium">{r.label}</TableCell>
                    {r.values.map((v, i) => <TableCell key={i} className="tabular-nums">{v}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
