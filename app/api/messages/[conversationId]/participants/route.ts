import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { addParticipantsSchema } from "@/lib/validators/message";
import { notifyUsers } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";

// Adds people to an existing group. Anyone who can create a group can grow
// one — mirrors the permission already required to create it in the first
// place, rather than introducing a separate "manage members" permission.
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.create_group");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation || !conversation.participants.some((p: { userId: string }) => p.userId === session.userId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "not_a_group", message: "Only group conversations have members to add." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addParticipantsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existingIds = new Set(conversation.participants.map((p: { userId: string }) => p.userId));
  const newIds = [...new Set(parsed.data.userIds)].filter((id) => !existingIds.has(id));
  if (newIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Everyone selected is already in this group." }, { status: 400 });
  }

  const newUsers = await db.user.findMany({ where: { id: { in: newIds } }, select: { id: true, name: true } });
  if (newUsers.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.conversationParticipant.createMany({
    data: newUsers.map((u: { id: string }) => ({ conversationId, userId: u.id })),
  });

  const actor = await db.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  const names = newUsers.map((u: { name: string }) => u.name).join(", ");
  await db.message.create({
    data: {
      conversationId,
      senderId: null,
      systemGenerated: true,
      body: `${actor?.name ?? "Someone"} added ${names} to the group.`,
    },
  });

  await notifyUsers(
    db,
    session.collegeId,
    newUsers.map((u: { id: string }) => u.id),
    "message.received",
    `Added to ${conversation.name ?? "a group"}`,
    `${actor?.name ?? "Someone"} added you to this group.`,
    `/messages/${conversationId}`,
  );

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "conversation.member_added",
    resourceType: "Conversation",
    resourceId: conversationId,
    after: { names: newUsers.map((u: { name: string }) => u.name) },
  });

  return NextResponse.json({ ok: true });
}
