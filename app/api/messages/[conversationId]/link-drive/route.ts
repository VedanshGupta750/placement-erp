import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { linkDriveSchema } from "@/lib/validators/message";
import { recordAudit } from "@/lib/audit";

// Links (or unlinks, with driveId: null) a conversation to a drive so the
// thread can show live drive context.
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
  const parsed = linkDriveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.userId } },
  });
  if (!participant) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Confirm the drive belongs to this tenant before linking (Drive is a
  // TENANT_MODEL, so this findUnique is already college-scoped).
  if (parsed.data.driveId) {
    const drive = await db.drive.findUnique({ where: { id: parsed.data.driveId }, select: { id: true } });
    if (!drive) return NextResponse.json({ error: "not_found", message: "Drive not found." }, { status: 404 });
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: { driveId: parsed.data.driveId },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: parsed.data.driveId ? "conversation.drive_linked" : "conversation.drive_unlinked",
    resourceType: "Conversation",
    resourceId: conversationId,
    after: parsed.data.driveId ? { driveId: parsed.data.driveId } : undefined,
  });

  return NextResponse.json({ ok: true });
}
