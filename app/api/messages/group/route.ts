import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createGroupSchema } from "@/lib/validators/message";
import { notifyConversationParticipants } from "@/lib/messages/notify";

// Creates a group conversation (Conversation + all ConversationParticipant
// rows + the first Message) in one request.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.create_group");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  // De-dupe participant ids and make sure the creator isn't double-added if
  // the client happened to include their own id.
  const otherParticipantIds = [...new Set(data.participantUserIds.filter((id) => id !== session.userId))];
  if (otherParticipantIds.length === 0) {
    return NextResponse.json(
      { error: "validation_error", message: "Add at least one other participant." },
      { status: 400 },
    );
  }

  const conversation = await db.conversation.create({
    data: {
      // collegeId is passed explicitly even though getTenantDb injects it —
      // TypeScript requires it statically. Established convention, see
      // lib/tenant/scoped-db.ts.
      collegeId: session.collegeId,
      isGroup: true,
      name: data.name,
      createdById: session.userId,
      participants: {
        create: [{ userId: session.userId }, ...otherParticipantIds.map((userId) => ({ userId }))],
      },
    },
  });

  await db.message.create({
    data: { conversationId: conversation.id, senderId: session.userId, body: data.body },
  });

  await notifyConversationParticipants(db, {
    collegeId: session.collegeId,
    conversationId: conversation.id,
    senderId: session.userId,
    preview: data.body,
  });

  return NextResponse.json({ ok: true, conversationId: conversation.id });
}
