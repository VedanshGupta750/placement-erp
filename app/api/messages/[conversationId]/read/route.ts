import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Marks a conversation as read (up to now) for the current user. Called by
// the thread view (Part B) when a conversation is opened.
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // Conversation is a TENANT_MODEL — this confirms the conversation belongs
  // to the caller's college before we touch the participant row.
  const conversation = await db.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
  });
  if (!participant) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
