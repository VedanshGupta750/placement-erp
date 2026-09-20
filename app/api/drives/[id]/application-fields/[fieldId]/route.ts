import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; fieldId: string }> }) {
  const session = await requireSession();
  const { id: driveId, fieldId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const field = await db.driveApplicationField.findUnique({ where: { id: fieldId } });
  if (!field || field.driveId !== driveId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.driveApplicationField.delete({ where: { id: fieldId } });

  return NextResponse.json({ ok: true });
}
