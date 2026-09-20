import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await requireSession();
  const { id: eventId, fileId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const file = await db.eventFile.findUnique({ where: { id: fileId } });
  if (!file || file.eventId !== eventId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.eventFile.delete({ where: { id: fileId } });

  return NextResponse.json({ ok: true });
}
