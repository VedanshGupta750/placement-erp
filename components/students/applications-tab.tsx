import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";

export async function ApplicationsTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const applications = await db.application.findMany({
    where: { studentId },
    include: { drive: { include: { company: true } }, position: true },
    orderBy: { appliedAt: "desc" },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        {applications.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No applications yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((a: {
                id: string;
                driveId: string;
                appliedAt: Date;
                matchScore: number | null;
                status: string;
                drive: { title: string; company: { name: string } };
                position: { title: string } | null;
              }) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/drives/${a.driveId}`} className="font-medium hover:underline">
                      {a.drive.company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{a.position?.title ?? a.drive.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{a.appliedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</TableCell>
                  <TableCell className="text-sm">{a.matchScore != null ? `${a.matchScore}%` : "—"}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
