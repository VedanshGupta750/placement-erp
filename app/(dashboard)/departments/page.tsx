import Link from "next/link";
import { Building2, Users, BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { CreateDepartmentDialog } from "@/components/departments/create-department-dialog";

export default async function DepartmentsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // No gate at all before — see app/(dashboard)/roles/page.tsx for the full
  // writeup of this finding across 6 sibling pages.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to departments.</CardContent>
      </Card>
    );
  }

  const departments = await db.department.findMany({
    include: { _count: { select: { memberships: true, courses: true } } },
    orderBy: { name: "asc" },
  });

  const studentCounts = await Promise.all(
    departments.map((d) => db.student.count({ where: { departmentId: d.id } })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Placement departments</h1>
          <p className="text-muted-foreground text-sm">Departments running placements on this platform, with their staff and reach.</p>
        </div>
        <CreateDepartmentDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d, i) => (
          <Link key={d.id} href={`/departments/${d.id}`}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-center gap-2">
                  <Building2 className="text-muted-foreground size-4" />
                  <span className="font-medium">{d.name}</span>
                </div>
                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><Users className="size-3" /> {d._count.memberships} team members</span>
                  <span className="flex items-center gap-1"><BookOpen className="size-3" /> {d._count.courses} courses</span>
                </div>
                <div className="text-muted-foreground text-xs">{studentCounts[i]} students</div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {departments.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">No departments yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
