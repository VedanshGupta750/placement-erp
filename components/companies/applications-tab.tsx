import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";

const APPLICATIONS_LIMIT = 200;

export async function ApplicationsTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const applications = await db.application.findMany({
    where: { drive: { companyId } },
    include: {
      student: { include: { user: true } },
      drive: { select: { title: true } },
      position: { select: { title: true } },
    },
    orderBy: { appliedAt: "desc" },
    take: APPLICATIONS_LIMIT,
  });

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          No applications yet for this company&apos;s drives.
        </CardContent>
      </Card>
    );
  }

  type ApplicationRow = (typeof applications)[number];

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Drive / Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((a: ApplicationRow) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/students/${a.studentId}`} className="hover:underline">
                    {a.student.user.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>{a.drive.title}</div>
                  <div className="text-muted-foreground text-xs">{a.position.title}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {new Date(a.appliedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {applications.length === APPLICATIONS_LIMIT && (
          <p className="text-muted-foreground border-t px-4 py-3 text-xs">
            Showing the 200 most recent applications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
