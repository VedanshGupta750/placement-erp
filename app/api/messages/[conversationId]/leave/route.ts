import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { recordAudit } from "@/lib/audit";

// Any member can leave a group they're in — no permission check beyond
// actually being a participant. 1:1 conversations can't be "left" (there's
// nothing sensible to hand the other participant), so those are rejected.
export async function POST(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation || !conversation.participants.some((p: { userId: string }) => p.userId === session.userId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "not_a_group", message: "You can't leave a direct message." }, { status: 400 });
  }

  const actor = await db.user.findUnique({ where: { id: session.userId }, select: { name: true } });

  await db.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
  });

  await db.message.create({
    data: {
      conversationId,
      senderId: null,
      systemGenerated: true,
      body: `${actor?.name ?? "Someone"} left the group.`,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "conversation.member_left",
    resourceType: "Conversation",
    resourceId: conversationId,
    after: { names: [actor?.name ?? session.userId] },
  });

  return NextResponse.json({ ok: true });
}
