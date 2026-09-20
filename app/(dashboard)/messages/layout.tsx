import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { ConversationList, type ConversationListItem } from "@/components/messages/conversation-list";
import { MessagesResponsiveShell } from "@/components/messages/messages-responsive-shell";

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Persistent 3-column shell for Messages: this layout renders the left
// conversation list once and keeps it mounted across /messages (empty
// state), /messages/[conversationId] (thread — owned by another agent) and
// /messages/contact/[contactId] (recruiter communication log — owned by
// another agent), which all render into `children`.
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [conversations, contacts, canCreateGroup] = await Promise.all([
    db.conversation.findMany({
      where: { participants: { some: { userId: session.userId } } },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    // Only surface a contact in the inbox if the current user owns it or it
    // has at least one logged communication — otherwise every contact ever
    // created would clutter the list.
    db.contact.findMany({
      where: { OR: [{ ownerId: session.userId }, { communications: { some: {} } }] },
      include: { company: true, communications: { orderBy: { occurredAt: "desc" }, take: 1 } },
    }),
    hasPermission(session, "message.create_group"),
  ]);

  // Unread count per conversation — messages sent by someone else, newer
  // than the caller's own lastReadAt. ConversationParticipant/Message have
  // no collegeId column, so they're scoped by hand via the already
  // tenant-verified conversationId rather than being TENANT_MODELS.
  const unreadCounts = new Map<string, number>();
  await Promise.all(
    conversations.map(async (c) => {
      const own = c.participants.find((p) => p.userId === session.userId);
      const count = await db.message.count({
        where: {
          conversationId: c.id,
          createdAt: { gt: own?.lastReadAt ?? new Date(0) },
          senderId: { not: session.userId },
        },
      });
      unreadCounts.set(c.id, count);
    }),
  );

  const conversationItems: ConversationListItem[] = conversations.map((c) => {
    const own = c.participants.find((p) => p.userId === session.userId);
    const other = c.participants.find((p) => p.userId !== session.userId)?.user;
    const last = c.messages[0];
    const displayName = c.isGroup ? (c.name ?? "Group chat") : (other?.name ?? "Conversation");
    const preview = !last
      ? "No messages yet"
      : last.body.trim()
        ? last.body
        : last.attachmentName
          ? `📎 ${last.attachmentName}`
          : "No messages yet";
    const unreadCount = unreadCounts.get(c.id) ?? 0;

    return {
      id: c.id,
      kind: "conversation",
      href: `/messages/${c.id}`,
      displayName,
      subtitle: c.isGroup ? `Group · ${c.participants.length} member${c.participants.length === 1 ? "" : "s"}` : undefined,
      preview,
      lastActivity: (last?.createdAt ?? c.createdAt).toISOString(),
      unread: unreadCount > 0,
      unreadCount,
      starred: own?.starred ?? false,
      isGroup: c.isGroup,
      typeDot: c.isGroup ? "violet" : other?.userType === "STUDENT" ? "blue" : "slate",
      initials: initials(displayName),
      avatarUrl: c.isGroup ? undefined : (other?.avatarUrl ?? undefined),
    };
  });

  const contactItems: ConversationListItem[] = contacts.map((contact) => {
    const lastComm = contact.communications[0];
    const displayName = contact.name ?? "Unnamed contact";
    const subtitle = [contact.designation, contact.company?.name].filter(Boolean).join(" · ") || undefined;
    const preview = lastComm ? (lastComm.subject ?? (lastComm.body ? lastComm.body.slice(0, 80) : "No communication logged yet")) : "No communication logged yet";

    return {
      id: contact.id,
      kind: "contact",
      href: `/messages/contact/${contact.id}`,
      displayName,
      subtitle,
      preview,
      lastActivity: (lastComm?.occurredAt ?? contact.createdAt).toISOString(),
      unread: false,
      unreadCount: 0,
      starred: false,
      isGroup: false,
      typeDot: contact.isActive && contact.relationshipStage !== "DORMANT" ? "green" : "gray",
      initials: initials(displayName),
      avatarUrl: contact.photoUrl ?? undefined,
    };
  });

  const items = [...conversationItems, ...contactItems].sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  );

  return (
    <MessagesResponsiveShell
      conversationList={<ConversationList items={items} canCreateGroup={canCreateGroup} />}
    >
      {children}
    </MessagesResponsiveShell>
  );
}
