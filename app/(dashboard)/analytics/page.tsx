import { TrendingUp, FileCheck2, Building2, Users, FileText, Video } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CourseBreakdownChart } from "@/components/reports/course-breakdown-chart";
import { getCollegeAnalytics } from "@/lib/analytics/stats";

export default async function AnalyticsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "report.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to analytics.</CardContent>
      </Card>
    );
  }

  const activeBatchId = await getActiveBatchId();
  const a = await getCollegeAnalytics(db, activeBatchId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm">Live placement performance for the current batch.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Placement %" value={`${a.placementPct.toFixed(1)}%`} sublabel={`${a.placedCount} of ${a.studentCount}`} color="blue" />
        <StatCard icon={FileCheck2} label="Total offers" value={a.offerCount} sublabel={`${a.placedCount} unique students`} color="emerald" />
        <StatCard icon={Building2} label="Companies" value={a.partnerships} sublabel={`${a.companiesWithOffers} made offers`} color="violet" />
        <StatCard icon={Users} label="Drives run" value={a.driveCount} color="amber" />
        <StatCard icon={FileText} label="Applications" value={a.applicationCount} color="sky" />
        <StatCard icon={Video} label="Interviews" value={a.interviewCount} sublabel={`${a.interviewConversionPct.toFixed(1)}% passed`} color="indigo" />
        <StatCard icon={TrendingUp} label="Avg package" value={`₹${(a.average / 100000).toFixed(1)}L`} color="teal" />
        <StatCard icon={TrendingUp} label="Highest package" value={`₹${(a.highest / 100000).toFixed(1)}L`} sublabel={`Median ₹${(a.median / 100000).toFixed(1)}L`} color="rose" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Placement rate by course</CardTitle></CardHeader>
        <CardContent>
          <CourseBreakdownChart data={a.courseRows.map((r) => ({ name: r.name.length > 18 ? r.name.slice(0, 18) + "…" : r.name, pct: Math.round(r.pct * 10) / 10 }))} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Department performance</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Placed</TableHead><TableHead>Total</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.departmentRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{r.placed}</TableCell>
                    <TableCell className="tabular-nums">{r.total}</TableCell>
                    <TableCell className="tabular-nums">{r.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {a.departmentRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">No data yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Company performance</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Drives</TableHead><TableHead>Offers</TableHead><TableHead>Avg package</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.companyRows.slice(0, 8).map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{r.drives}</TableCell>
                    <TableCell className="tabular-nums">{r.offers}</TableCell>
                    <TableCell className="tabular-nums">₹{(r.avgPackage / 100000).toFixed(1)}L</TableCell>
                  </TableRow>
                ))}
                {a.companyRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">No data yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
