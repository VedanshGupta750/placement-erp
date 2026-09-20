import { BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddCourseForm } from "@/components/people/add-course-form";

export default async function CoursesPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // No gate at all before — see app/(dashboard)/roles/page.tsx for the full
  // writeup of this finding across 6 sibling pages.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to courses.</CardContent>
      </Card>
    );
  }

  const courses = await db.course.findMany({ include: { _count: { select: { students: true } } }, orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="text-muted-foreground text-sm">The master catalogue every drive and student filter draws from.</p>
      </div>

      <StatCard icon={BookOpen} label="Total courses" value={courses.length} color="blue" />

      <AddCourseForm />

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Degree</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Years</TableHead>
                <TableHead>Students</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.degree}</TableCell>
                  <TableCell>{c.specialization ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{c.years}</TableCell>
                  <TableCell className="tabular-nums">{c._count.students}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
