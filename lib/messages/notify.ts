import { notifyUsers } from "@/lib/notify";

const PREVIEW_MAX = 140;

// Notifies every participant of a conversation except the sender, so a new
// message actually surfaces in the bell menu instead of only being visible
// to someone who happens to open /messages. Mirrors the IN_APP-only reality
// of lib/notify.ts — there's no outbound email/SMS provider wired up.
// `db` is intentionally untyped (`any`) — tenant-scoped client, same
// convention as lib/notify.ts / lib/applications.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyConversationParticipants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: {
    collegeId: string;
    conversationId: string;
    senderId: string;
    preview: string;
  },
) {
  const [conversation, sender] = await Promise.all([
    db.conversation.findUnique({
      where: { id: input.conversationId },
      include: { participants: { select: { userId: true } } },
    }),
    db.user.findUnique({ where: { id: input.senderId }, select: { name: true } }),
  ]);
  if (!conversation) return;

  const recipientIds = conversation.participants
    .map((p: { userId: string }) => p.userId)
    .filter((id: string) => id !== input.senderId);
  if (recipientIds.length === 0) return;

  const senderName = sender?.name ?? "Someone";
  const title = conversation.isGroup
    ? `${senderName} in ${conversation.name ?? "a group"}`
    : `New message from ${senderName}`;
  const body = input.preview.length > PREVIEW_MAX ? `${input.preview.slice(0, PREVIEW_MAX)}…` : input.preview;

  await notifyUsers(
    db,
    input.collegeId,
    recipientIds,
    "message.received",
    title,
    body,
    `/messages/${input.conversationId}`,
  );
}
