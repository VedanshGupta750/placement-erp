import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { COLLEGE_PERMISSION_KEYS, type PermissionKey } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

// Replaces a role's full permission set with the given list — simpler and
// less error-prone than diffing add/remove for a checkbox-grid UI.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const role = await db.role.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (role.name === "TPO") {
    return NextResponse.json({ error: "protected_role", message: "The TPO role always has full access and can't be edited." }, { status: 400 });
  }

  const { permissionKeys } = await request.json().catch(() => ({ permissionKeys: [] }));
  // Platform-tier keys are excluded here, not just hidden in the roles UI —
  // otherwise a hand-crafted PATCH could grant a college role api.*/billing.*
  // even though the checkbox grid never offers them.
  const validKeys = new Set(COLLEGE_PERMISSION_KEYS);
  const keys: string[] = Array.isArray(permissionKeys) ? permissionKeys.filter((k: string) => validKeys.has(k as PermissionKey)) : [];

  const permissions = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: id, permissionId: p.id })) }),
  ]);

  return NextResponse.json({ ok: true });
}
