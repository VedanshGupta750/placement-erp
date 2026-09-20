import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Users2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { ACTIVE_DRIVE_STATUSES } from "@/lib/contacts/stats";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageThread } from "@/components/messages/message-thread";
import { MessageComposer } from "@/components/messages/message-composer";
import { ContextPanel } from "@/components/messages/context-panel";
import { RequestDetectorCard } from "@/components/messages/request-detector-card";
import { ConversationSidePanels } from "@/components/messages/conversation-side-panels";
import { LinkDriveDialog } from "@/components/messages/link-drive-dialog";
import { getConversationDriveContext } from "@/lib/messages/drive-context";
import { AUDIT_LABELS } from "@/lib/audit";
import { GroupMembersPanel } from "@/components/messages/group-members-panel";

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [canView, canCreateGroup] = await Promise.all([
    hasPermission(session, "message.view"),
    hasPermission(session, "message.create_group"),
  ]);
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to messages.</CardContent>
      </Card>
    );
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { include: { user: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: true } },
    },
  });
  if (!conversation || !conversation.participants.some((p: { userId: string }) => p.userId === session.userId)) notFound();

  const [driveContext, driveOptions, auditEvents, drafts] = await Promise.all([
    conversation.driveId ? getConversationDriveContext(db, conversation.driveId) : Promise.resolve(null),
    db.drive.findMany({
      select: { id: true, title: true, company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // Recorded, non-content events for this conversation (file shares, drive
    // links) — see lib/audit.ts for why message bodies aren't audited.
    db.auditLog.findMany({
      where: { resourceType: "Conversation", resourceId: conversationId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.messageDraft.findMany({
      where: { conversationId, authorId: session.userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activity = auditEvents.map((e: {
    id: string;
    action: string;
    after: unknown;
    createdAt: Date;
    actor: { name: string } | null;
  }) => {
    const after = (e.after ?? {}) as { fileName?: string; driveId?: string; names?: string[] };
    return {
      id: e.id,
      label: AUDIT_LABELS[e.action] ?? e.action,
      detail: after.fileName ?? (after.names ? after.names.join(", ") : null),
      actorName: e.actor?.name ?? null,
      at: e.createdAt.toISOString(),
    };
  });

  const sharedFiles = conversation.messages
    .filter((m: { attachmentUrl: string | null }) => !!m.attachmentUrl)
    .map((m: {
      id: string;
      attachmentUrl: string | null;
      attachmentName: string | null;
      attachmentSizeBytes: number | null;
      createdAt: Date;
      sender: { name: string } | null;
    }) => ({
      id: m.id,
      url: m.attachmentUrl!,
      name: m.attachmentName ?? "Attachment",
      sizeBytes: m.attachmentSizeBytes,
      createdAt: m.createdAt.toISOString(),
      senderName: m.sender?.name ?? null,
    }))
    .reverse();

  // Mark read on open. Wrapped so a write failure never blocks rendering the
  // conversation itself — worst case the unread badge lingers until next visit.
  try {
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: session.userId } },
      data: { lastReadAt: new Date() },
    });
  } catch {
    // non-fatal
  }

  const otherParticipant = conversation.participants.find((p: { userId: string }) => p.userId !== session.userId);
  const other = otherParticipant?.user;
  const title = conversation.isGroup ? (conversation.name ?? "Group chat") : (other?.name ?? "Conversation");

  // Student context for the right panel (1:1 with a student only).
  let studentContext:
    | {
        department: string | null;
        course: string | null;
        cgpa: number | null;
        applicationsCount: number;
        activeDrivesCount: number;
        interviewsCount: number;
        offersCount: number;
      }
    | undefined;

  if (!conversation.isGroup && other?.userType === "STUDENT") {
    const student = await db.student.findFirst({
      where: { userId: other.id },
      include: { department: true, course: true },
    });
    if (student) {
      // "Interviews" in this app are RoundCandidate rows — the same source
      // the /interviews page counts from.
      const [applicationsCount, offersCount, activeApplications, interviewsCount] = await Promise.all([
        db.application.count({ where: { studentId: student.id } }),
        db.offer.count({ where: { studentId: student.id } }),
        db.application.findMany({
          where: { studentId: student.id, drive: { status: { in: [...ACTIVE_DRIVE_STATUSES] } } },
          select: { driveId: true },
        }),
        db.roundCandidate.count({ where: { studentId: student.id } }),
      ]);

      studentContext = {
        department: student.department?.name ?? null,
        course: student.course?.specialization ?? student.course?.name ?? null,
        cgpa: student.aggregate != null ? Number(student.aggregate) : null,
        applicationsCount,
        activeDrivesCount: new Set(activeApplications.map((a: { driveId: string }) => a.driveId)).size,
        interviewsCount,
        offersCount,
      };
    }
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-4 xl:h-full xl:min-h-0 xl:flex-row">
      <div className="flex h-[calc(100dvh-9rem)] min-h-[32rem] min-w-0 shrink-0 flex-col xl:h-auto xl:min-h-0 xl:flex-1">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 w-fit lg:hidden"
          render={<Link href="/messages" />}
        >
          <ArrowLeft className="size-4" /> Back to messages
        </Button>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar size="lg">
              {!conversation.isGroup && other?.avatarUrl && <AvatarImage src={other.avatarUrl} alt={title} />}
              <AvatarFallback>{conversation.isGroup ? <Users2 className="size-4" /> : initials(title)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="max-w-full truncate text-lg font-semibold tracking-tight">{title}</h1>
                {conversation.isGroup && (
                  <Badge variant="outline">
                    {conversation.participants.length} member{conversation.participants.length === 1 ? "" : "s"}
                  </Badge>
                )}
                {!conversation.isGroup && other?.userType && <Badge variant="outline">{other.userType}</Badge>}
              </div>
              {!conversation.isGroup && other?.email && (
                <p className="text-muted-foreground truncate text-sm">{other.email}</p>
              )}
            </div>
          </div>

          {!conversation.isGroup && (
            <div className="flex flex-wrap items-center gap-2">
              {other?.email && (
                <Button variant="outline" size="sm" render={<a href={`mailto:${other.email}`} />}>
                  <Mail className="size-3.5" /> Email
                </Button>
              )}
              {other?.phone && (
                <Button variant="outline" size="sm" render={<a href={`tel:${other.phone}`} />}>
                  <Phone className="size-3.5" /> Call
                </Button>
              )}
            </div>
          )}
        </div>

        <MessageThread
          currentUserId={session.userId}
          isGroup={conversation.isGroup}
          otherLastReadAt={otherParticipant?.lastReadAt ? otherParticipant.lastReadAt.toISOString() : null}
          messages={conversation.messages.map((m: {
            id: string;
            body: string;
            createdAt: Date;
            senderId: string | null;
            sender: { name: string } | null;
            systemGenerated: boolean;
            attachmentUrl: string | null;
            attachmentName: string | null;
            attachmentSizeBytes: number | null;
          }) => ({
            id: m.id,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
            senderId: m.senderId,
            senderName: m.sender?.name ?? null,
            systemGenerated: m.systemGenerated,
            attachmentUrl: m.attachmentUrl,
            attachmentName: m.attachmentName,
            attachmentSizeBytes: m.attachmentSizeBytes,
          }))}
        />

        <MessageComposer
          conversationId={conversation.id}
          mentionablePeople={
            conversation.isGroup
              ? conversation.participants
                  .filter((p: { userId: string }) => p.userId !== session.userId)
                  .map((p: { userId: string; user: { name: string } }) => ({ id: p.userId, name: p.user.name }))
              : []
          }
          templateVariables={{
            ...(other ? { student_name: other.name, recipient_name: other.name } : {}),
            ...(driveContext
              ? {
                  drive_name: driveContext.title,
                  ...(driveContext.companyName ? { company_name: driveContext.companyName } : {}),
                }
              : {}),
          }}
        />
      </div>

      <aside className="min-h-80 w-full shrink-0 overflow-visible border-t pt-4 xl:min-h-0 xl:w-80 xl:overflow-y-auto xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
        <ConversationSidePanels
          driveContext={driveContext}
          files={sharedFiles}
          activity={activity}
          conversationId={conversation.id}
          drafts={drafts.map((d: { id: string; body: string; createdAt: Date }) => ({
            id: d.id,
            body: d.body,
            createdAt: d.createdAt.toISOString(),
          }))}
          requestDetector={<RequestDetectorCard conversationId={conversation.id} />}
          driveLinker={
            <LinkDriveDialog
              conversationId={conversation.id}
              isLinked={!!driveContext}
              drives={driveOptions.map((d: { id: string; title: string; company: { name: string } | null }) => ({
                id: d.id,
                title: d.title,
                companyName: d.company?.name ?? null,
              }))}
            />
          }
        >
          {conversation.isGroup ? (
            <GroupMembersPanel
              conversationId={conversation.id}
              currentUserId={session.userId}
              isCreator={conversation.createdById === session.userId}
              canAddMembers={canCreateGroup}
              members={conversation.participants.map((p: { userId: string; user: { id: string; name: string; email: string; avatarUrl: string | null } }) => ({
                userId: p.userId,
                name: p.user.name,
                email: p.user.email,
                avatarUrl: p.user.avatarUrl,
              }))}
            />
          ) : other ? (
            <ContextPanel
              kind="user"
              user={{
                id: other.id,
                name: other.name,
                email: other.email,
                userType: other.userType,
                avatarUrl: other.avatarUrl ?? null,
              }}
              student={studentContext}
            />
          ) : null}
        </ConversationSidePanels>
      </aside>
    </div>
  );
}
