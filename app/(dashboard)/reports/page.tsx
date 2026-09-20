import Link from "next/link";
import { FileText, FileDown } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCollegeAnalytics } from "@/lib/analytics/stats";
import { cn } from "@/lib/utils";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const activeTab = ["department", "leaderboard", "companies"].includes(tab ?? "") ? tab! : "college";
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // Same missing-gate class fixed across roles/settings/people/departments/
  // courses/categories — Student doesn't hold report.view, but this page
  // had no gate at all and leaked package leaderboards, per-student
  // rankings, and company-wise compensation data to any logged-in student.
  const canView = await hasPermission(session, "report.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to reports.</CardContent>
      </Card>
    );
  }
  const canExport = await hasPermission(session, "report.export");

  const activeBatchId = await getActiveBatchId();
  const a = await getCollegeAnalytics(db, activeBatchId);

  const tabs = [
    { key: "college", label: "College Summary" },
    { key: "department", label: "Department Report" },
    { key: "leaderboard", label: "Course Leaderboard" },
    { key: "companies", label: "Company Report" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">Formal, exportable placement reports for the current batch.</p>
        </div>
        {canExport && (
          <Button className="max-w-full shrink-0" variant="outline" render={<a href="/api/reports/pdf" />}>
            <FileDown className="size-4" /> Download Placement Summary (PDF)
          </Button>
        )}
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-full w-fit gap-1 overflow-x-auto overscroll-x-contain rounded-lg border p-1 [scrollbar-width:thin]">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "college" ? "/reports" : `/reports?tab=${t.key}`}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {canExport && activeTab !== "college" && (
          <Button variant="outline" size="sm" render={<a href={`/api/reports/export?type=${activeTab === "leaderboard" ? "course" : activeTab}`} />}>
            <FileText className="size-4" /> Export CSV
          </Button>
        )}
      </div>

      {activeTab === "college" && (
        <Card>
          <CardHeader><CardTitle className="text-base">College placement summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><div className="text-muted-foreground text-xs">Placement %</div><div className="text-xl font-bold tabular-nums">{a.placementPct.toFixed(1)}%</div></div>
            <div><div className="text-muted-foreground text-xs">Students placed</div><div className="text-xl font-bold tabular-nums">{a.placedCount} / {a.studentCount}</div></div>
            <div><div className="text-muted-foreground text-xs">Total offers</div><div className="text-xl font-bold tabular-nums">{a.offerCount}</div></div>
            <div><div className="text-muted-foreground text-xs">Companies</div><div className="text-xl font-bold tabular-nums">{a.companiesWithOffers}</div></div>
            <div><div className="text-muted-foreground text-xs">Highest package</div><div className="text-xl font-bold tabular-nums">₹{(a.highest / 100000).toFixed(1)}L</div></div>
            <div><div className="text-muted-foreground text-xs">Average package</div><div className="text-xl font-bold tabular-nums">₹{(a.average / 100000).toFixed(1)}L</div></div>
            <div><div className="text-muted-foreground text-xs">Median package</div><div className="text-xl font-bold tabular-nums">₹{(a.median / 100000).toFixed(1)}L</div></div>
            <div><div className="text-muted-foreground text-xs">Drives run</div><div className="text-xl font-bold tabular-nums">{a.driveCount}</div></div>
          </CardContent>
        </Card>
      )}

      {activeTab === "department" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Department-wise placement report</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[32rem]">
              <TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Total students</TableHead><TableHead>Placed</TableHead><TableHead>Placement %</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.departmentRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{r.total}</TableCell>
                    <TableCell className="tabular-nums">{r.placed}</TableCell>
                    <TableCell className="tabular-nums">{r.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {a.departmentRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground py-10 text-center text-sm">No data yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "leaderboard" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Course leaderboard — ranked by placement %</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[46rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead><TableHead>Course</TableHead><TableHead>Placement %</TableHead><TableHead>Placed</TableHead>
                  <TableHead>Total</TableHead><TableHead>Offers</TableHead><TableHead>Avg package</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.courseRows.map((r, i) => (
                  <TableRow key={r.name}>
                    <TableCell className="text-muted-foreground tabular-nums">#{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{r.pct.toFixed(1)}%</TableCell>
                    <TableCell className="tabular-nums">{r.placed}</TableCell>
                    <TableCell className="tabular-nums">{r.total}</TableCell>
                    <TableCell className="tabular-nums">{r.offers}</TableCell>
                    <TableCell className="tabular-nums">₹{(r.avgPackage / 100000).toFixed(1)}L</TableCell>
                  </TableRow>
                ))}
                {a.courseRows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">No data yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "companies" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Company-wise breakdown</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead><TableHead>Drives run</TableHead><TableHead>Offers made</TableHead>
                  <TableHead>Students placed</TableHead><TableHead>Avg package</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.companyRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{r.drives}</TableCell>
                    <TableCell className="tabular-nums">{r.offers}</TableCell>
                    <TableCell className="tabular-nums">{r.placed}</TableCell>
                    <TableCell className="tabular-nums">₹{(r.avgPackage / 100000).toFixed(1)}L</TableCell>
                  </TableRow>
                ))}
                {a.companyRows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">No data yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
