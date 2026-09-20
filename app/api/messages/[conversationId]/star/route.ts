import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { starConversationSchema } from "@/lib/validators/message";

// Stars/unstars a conversation for the current user only (per-participant
// flag, not shared across the conversation).
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

  const body = await request.json().catch(() => null);
  const parsed = starConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const conversation = await db.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
  });
  if (!participant) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
    data: { starred: parsed.data.starred },
  });

  return NextResponse.json({ ok: true });
}
