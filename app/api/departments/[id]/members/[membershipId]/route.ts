import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  const session = await requireSession();
  const { id: departmentId, membershipId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const department = await db.department.findUnique({ where: { id: departmentId } });
  if (!department) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.departmentMembership.delete({ where: { id: membershipId } });
  return NextResponse.json({ ok: true });
}
