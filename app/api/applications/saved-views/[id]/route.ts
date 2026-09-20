import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const view = await db.applicationSavedView.findUnique({ where: { id } });
  if (!view || view.userId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await db.applicationSavedView.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
