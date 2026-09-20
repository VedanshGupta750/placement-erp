import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { recordAudit } from "@/lib/audit";

// Removes a member from a group. Restricted to the conversation's creator —
// unlike adding members (open to anyone with message.create_group), letting
// any member kick any other member would be a real abuse vector. Removing
// yourself goes through /leave instead, which any member can do.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string; userId: string }> },
) {
  const { conversationId, userId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "not_a_group", message: "Only group conversations have members to remove." }, { status: 400 });
  }
  if (conversation.createdById !== session.userId) {
    return NextResponse.json({ error: "forbidden", message: "Only the group's creator can remove members." }, { status: 403 });
  }
  if (userId === session.userId) {
    return NextResponse.json({ error: "validation_error", message: "Use Leave group to remove yourself." }, { status: 400 });
  }
  if (!conversation.participants.some((p: { userId: string }) => p.userId === userId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [removedUser, actor] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  await db.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId } },
  });

  await db.message.create({
    data: {
      conversationId,
      senderId: null,
      systemGenerated: true,
      body: `${actor?.name ?? "Someone"} removed ${removedUser?.name ?? "a member"} from the group.`,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "conversation.member_removed",
    resourceType: "Conversation",
    resourceId: conversationId,
    after: { names: [removedUser?.name ?? userId] },
  });

  return NextResponse.json({ ok: true });
}
