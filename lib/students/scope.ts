import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";

type Session = { userId: string; collegeId: string; roleId: string | null };

// Row-level scoping for the Students module: a Department Coordinator can
// only see/act on students in the department(s) they're a member of
// (DepartmentMembership), even though the RBAC permission check
// (student.view/student.edit) is otherwise identical to a TPO's. Every
// other role gets an unrestricted `{}` — this is additive to the tenant
// (collegeId) scoping getTenantDb already does, not a replacement for it.
export async function getStudentScopeWhere(db: TenantDb, session: Session): Promise<Record<string, unknown>> {
  if (!session.roleId) return {};

  const role = await db.role.findUnique({ where: { id: session.roleId }, select: { name: true } });
  if (role?.name !== "Department Coordinator") return {};

  const memberships = await db.departmentMembership.findMany({
    where: { userId: session.userId },
    select: { departmentId: true },
  });
  const departmentIds = memberships.map((m: { departmentId: string }) => m.departmentId);

  // A coordinator with no department membership on file sees nobody rather
  // than everybody — fail closed, not open.
  return { departmentId: { in: departmentIds } };
}
