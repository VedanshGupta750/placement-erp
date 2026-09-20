import { notFound } from "next/navigation";
import { Building2, Users, BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddMemberDialog } from "@/components/departments/add-member-dialog";
import { RemoveMemberButton } from "@/components/departments/remove-member-button";

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // No gate at all before — see app/(dashboard)/roles/page.tsx for the full
  // writeup of this finding across the Settings-area pages.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this department.</CardContent>
      </Card>
    );
  }

  const department = await db.department.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
      courses: { include: { course: true } },
    },
  });
  if (!department) notFound();

  const [studentCount, staff] = await Promise.all([
    db.student.count({ where: { departmentId: department.id } }),
    db.user.findMany({ where: { userType: { not: "STUDENT" } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  const memberUserIds = new Set(department.memberships.map((m) => m.userId));
  const availableStaff = staff.filter((s) => !memberUserIds.has(s.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Building2 className="text-muted-foreground size-5" />
        <h1 className="text-2xl font-semibold tracking-tight">{department.name}</h1>
        {department.code && <Badge variant="outline">{department.code}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Team members" value={department.memberships.length} color="blue" />
        <StatCard icon={BookOpen} label="Courses" value={department.courses.length} color="violet" />
        <StatCard icon={Users} label="Students" value={studentCount} color="emerald" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Team members</CardTitle>
          <AddMemberDialog departmentId={department.id} staff={availableStaff} />
        </CardHeader>
        <CardContent>
          {department.memberships.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No team members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {department.memberships.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.user.name}</div>
                      <div className="text-muted-foreground text-xs">{m.user.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{m.designation}</TableCell>
                    <TableCell><Badge variant="outline">{m.title}</Badge></TableCell>
                    <TableCell>
                      {m.isAdmin ? (
                        <Badge className="border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RemoveMemberButton departmentId={department.id} membershipId={m.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Courses</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {department.courses.map((dc) => (
            <Badge key={dc.courseId} variant="outline">{dc.course.specialization ?? dc.course.name}</Badge>
          ))}
          {department.courses.length === 0 && <p className="text-muted-foreground text-sm">No courses linked yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
