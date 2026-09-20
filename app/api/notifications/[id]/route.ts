import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  await db.notification.updateMany({
    where: { id, userId: session.userId },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
