import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createDraftSchema } from "@/lib/validators/message";

// Saves a message the author intends to send later themselves. This is
// explicitly NOT scheduled delivery — see the MessageDraft model comment.
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.send");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
  });
  if (!participant) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const draft = await db.messageDraft.create({
    data: {
      conversationId,
      authorId: session.userId,
      body: parsed.data.body,
      remindAt: parsed.data.remindAt ? new Date(parsed.data.remindAt) : null,
    },
  });

  return NextResponse.json({ ok: true, id: draft.id });
}
