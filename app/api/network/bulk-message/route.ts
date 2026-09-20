import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Sends the same message as N separate 1:1 conversations, not a group
// chat — matches the Network spec's "Message" bulk action (distinct from
// "Send Announcement", which deep-links to the real Broadcasts module
// instead of being duplicated here). Reuses the exact find-or-create-1:1-
// conversation logic POST /api/messages already has, kept self-contained
// here rather than risk editing that route's shared, already-working path.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.send");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
  // message.send alone would let a Student call this directly even though
  // the Network UI only ever shows bulk-select to staff (isStaff in
  // app/(dashboard)/network/page.tsx) — bulk messaging up to 200 people at
  // once is a staff/coordinator tool, not something to leave reachable by
  // API alone just because the individual-message permission overlaps.
  const caller = await db.user.findUnique({ where: { id: session.userId }, select: { userType: true } });
  if (caller?.userType === "STUDENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds.filter((id: unknown) => typeof id === "string") : [];
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (userIds.length === 0 || !text) {
    return NextResponse.json({ error: "validation_error", message: "Select recipients and write a message." }, { status: 400 });
  }
  if (userIds.length > 200) {
    return NextResponse.json({ error: "validation_error", message: "Bulk messaging is limited to 200 recipients at a time." }, { status: 400 });
  }

  let successCount = 0;
  for (const recipientUserId of userIds) {
    if (recipientUserId === session.userId) continue;
    const existing = await db.conversation.findFirst({
      where: { isGroup: false, participants: { some: { userId: session.userId } }, AND: [{ participants: { some: { userId: recipientUserId } } }] },
    });
    const conversationId = existing
      ? existing.id
      : (
          await db.conversation.create({
            data: { collegeId: session.collegeId, isGroup: false, createdById: session.userId, participants: { create: [{ userId: session.userId }, { userId: recipientUserId }] } },
          })
        ).id;

    await db.message.create({ data: { conversationId, senderId: session.userId, body: text } });
    successCount += 1;
  }

  return NextResponse.json({ ok: true, successCount });
}
