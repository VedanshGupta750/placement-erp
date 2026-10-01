import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

// Deleting a department is not uniformly safe, because its relations behave
// differently:
//   Drive.departmentId        required -> the database REFUSES the delete
//   Student.departmentId      optional -> students are silently unassigned
//   DepartmentCourse, DepartmentMembership -> cascade away
//
// So this refuses outright when drives exist (rather than letting a raw
// foreign-key error surface as a 500), and reports the student count so the
// UI can warn before anyone is unassigned.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    // Departments are college configuration, same bar as editing settings.
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const department = await db.department.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { drives: true, students: true, memberships: true, courses: true } },
    },
  });
  if (!department) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (department._count.drives > 0) {
    return NextResponse.json(
      {
        error: "has_drives",
        message: `"${department.name}" still has ${department._count.drives} drive${
          department._count.drives === 1 ? "" : "s"
        }. Move or delete those first — a drive must belong to a department.`,
      },
      { status: 409 },
    );
  }

  await db.department.delete({ where: { id } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "department.deleted",
    resourceType: "Department",
    resourceId: id,
    after: {
      name: department.name,
      studentsUnassigned: department._count.students,
      membershipsRemoved: department._count.memberships,
      courseLinksRemoved: department._count.courses,
    },
  });

  return NextResponse.json({ ok: true, studentsUnassigned: department._count.students });
}
