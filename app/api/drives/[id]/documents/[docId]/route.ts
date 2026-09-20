import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await requireSession();
  const { id: driveId, docId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drive = await db.drive.findUnique({ where: { id: driveId } });
  if (!drive) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.driveDocument.delete({ where: { id: docId } });
  return NextResponse.json({ ok: true });
}
