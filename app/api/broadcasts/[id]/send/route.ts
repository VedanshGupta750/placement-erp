import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { resolveAudienceUserIds } from "@/lib/broadcasts";
import { notifyUsers } from "@/lib/notify";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "broadcast.send");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const broadcast = await db.broadcast.findUnique({ where: { id } });
  if (!broadcast) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (broadcast.status === "SENT") return NextResponse.json({ error: "already_sent" }, { status: 409 });

  const userIds = await resolveAudienceUserIds(db, session.collegeId, broadcast);

  await db.broadcast.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  if (userIds.length > 0) {
    await db.broadcastRecipient.createMany({
      data: userIds.map((userId: string) => ({ broadcastId: id, userId })),
      skipDuplicates: true,
    });
  }
  await notifyUsers(db, session.collegeId, userIds, "broadcast.sent", broadcast.subject, broadcast.body);

  return NextResponse.json({ ok: true, recipientCount: userIds.length });
}
