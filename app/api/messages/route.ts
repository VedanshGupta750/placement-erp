import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { sendMessageSchema } from "@/lib/validators/message";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";
import { notifyConversationParticipants } from "@/lib/messages/notify";
import { recordAudit } from "@/lib/audit";

type Attachment = { url: string; name: string; mimeType: string; sizeBytes: number };

// Sends a message — creates a new 1:1 conversation on first contact with a
// recipient, or appends to an existing one. Group conversations are created
// by POST /api/messages/group.
//
// Accepts two request shapes: JSON (starting a conversation from the New
// Message dialog) and multipart/form-data (the in-thread composer, which can
// carry a file). Attachments follow the same no-object-storage convention as
// contact documents — stored as a data URI on the row (see lib/uploads).
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.send");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data") ?? false;

  let data: { conversationId?: string; recipientUserId?: string; body: string };
  let attachment: Attachment | null = null;

  if (isMultipart) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "validation_error", message: "Couldn't read the upload." }, { status: 400 });
    }
    const file = formData.get("file");
    const rawBody = String(formData.get("body") ?? "").trim();
    const conversationId = String(formData.get("conversationId") ?? "").trim();

    if (file instanceof File && file.size > 0) {
      const result = await readFileAsDataUri(file);
      if (!result.ok) {
        return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
      }
      attachment = { url: result.dataUri, name: file.name, mimeType: file.type, sizeBytes: file.size };
    }

    // A message needs either text or a file — an empty one isn't valid.
    if (!rawBody && !attachment) {
      return NextResponse.json({ error: "validation_error", message: "Message can't be empty." }, { status: 400 });
    }
    if (!conversationId) {
      return NextResponse.json({ error: "validation_error", message: "conversationId required." }, { status: 400 });
    }
    data = { conversationId, body: rawBody };
  } else {
    const body = await request.json().catch(() => null);
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    data = parsed.data;
  }

  let conversationId = data.conversationId;

  if (!conversationId) {
    if (!data.recipientUserId) {
      return NextResponse.json({ error: "validation_error", message: "recipientUserId required for a new conversation" }, { status: 400 });
    }
    // Reuse an existing 1:1 conversation between these two users if one exists.
    const existing = await db.conversation.findFirst({
      where: {
        isGroup: false,
        participants: { some: { userId: session.userId } },
        AND: [{ participants: { some: { userId: data.recipientUserId } } }],
      },
    });
    if (existing) {
      conversationId = existing.id;
    } else {
      const conversation = await db.conversation.create({
        data: {
          collegeId: session.collegeId,
          isGroup: false,
          createdById: session.userId,
          participants: { create: [{ userId: session.userId }, { userId: data.recipientUserId }] },
        },
      });
      conversationId = conversation.id;
    }
  } else {
    const member = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: session.userId } },
    });
    if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const message = await db.message.create({
    data: {
      conversationId: conversationId!,
      senderId: session.userId,
      body: data.body,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentMimeType: attachment?.mimeType,
      attachmentSizeBytes: attachment?.sizeBytes,
    },
  });

  await notifyConversationParticipants(db, {
    collegeId: session.collegeId,
    conversationId: conversationId!,
    senderId: session.userId,
    preview: data.body || (attachment ? `Sent an attachment: ${attachment.name}` : ""),
  });

  // Only file shares are audited — the message body itself stays out of the
  // audit trail on purpose (see lib/audit.ts).
  if (attachment) {
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "message.file_shared",
      resourceType: "Conversation",
      resourceId: conversationId,
      after: { fileName: attachment.name, sizeBytes: attachment.sizeBytes },
    });
  }

  return NextResponse.json({ ok: true, conversationId, messageId: message.id });
}
