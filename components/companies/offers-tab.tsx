import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getCompanyPackageAnalytics, getCompanyDepartmentBreakdown } from "@/lib/companies/stats";

export async function OffersTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [packageStats, departmentBreakdown, offers] = await Promise.all([
    getCompanyPackageAnalytics(db, companyId),
    getCompanyDepartmentBreakdown(db, companyId),
    db.offer.findMany({
      where: { drive: { companyId } },
      include: {
        student: { include: { user: true } },
        drive: { select: { title: true } },
        position: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const maxDeptCount = departmentBreakdown.length > 0 ? departmentBreakdown[0].count : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><div className="text-muted-foreground text-xs">Min CTC</div><div className="font-semibold">{packageStats.minCtc != null ? `₹${(packageStats.minCtc / 100000).toFixed(1)}L` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Max CTC</div><div className="font-semibold">{packageStats.maxCtc != null ? `₹${(packageStats.maxCtc / 100000).toFixed(1)}L` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Average CTC</div><div className="font-semibold">{packageStats.avgCtc != null ? `₹${(packageStats.avgCtc / 100000).toFixed(1)}L` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Median CTC</div><div className="font-semibold">{packageStats.medianCtc != null ? `₹${(packageStats.medianCtc / 100000).toFixed(1)}L` : "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Department Hired</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {departmentBreakdown.length === 0 && <p className="text-muted-foreground text-sm">No hires yet.</p>}
            {departmentBreakdown.map((d: { label: string; count: number }) => (
              <div key={d.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{d.label}</span>
                  <span className="tabular-nums">{d.count}</span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: maxDeptCount > 0 ? `${(d.count / maxDeptCount) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Offers</CardTitle></CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No offers made yet for this company&apos;s drives.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Role / Position</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Offer Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((o: {
                  id: string;
                  status: string;
                  totalCompensation: unknown;
                  offerDate: Date | null;
                  studentId: string;
                  student: { user: { name: string } };
                  drive: { title: string };
                  position: { title: string } | null;
                }) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/students/${o.studentId}`} className="text-primary hover:underline">
                        {o.student.user.name}
                      </Link>
                    </TableCell>
                    <TableCell>{o.position?.title ?? o.drive.title}</TableCell>
                    <TableCell className="tabular-nums">
                      {o.totalCompensation != null ? `₹${(Number(o.totalCompensation) / 100000).toFixed(1)}L` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {o.offerDate ? new Date(o.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
