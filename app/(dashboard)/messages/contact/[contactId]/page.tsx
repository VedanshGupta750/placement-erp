import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, ArrowLeft, ArrowUpRight, Users, StickyNote, MessageSquare, Info } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { getCompanyHiringActivity, ACTIVE_DRIVE_STATUSES } from "@/lib/contacts/stats";
import { computeRelationshipScore } from "@/lib/contacts/relationship-score";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContextPanel } from "@/components/messages/context-panel";
import { ContactConversationComposer } from "@/components/messages/contact-conversation-composer";

const COMMUNICATION_LABELS: Record<string, string> = {
  EMAIL_SENT: "Email sent",
  EMAIL_RECEIVED: "Email received",
  CALL: "Call",
  MEETING: "Meeting",
  NOTE: "Note",
  MESSAGE: "Message",
};

const COMMUNICATION_ICONS: Record<string, React.ElementType> = {
  EMAIL_SENT: Mail,
  EMAIL_RECEIVED: Mail,
  CALL: Phone,
  MEETING: Users,
  NOTE: StickyNote,
  MESSAGE: MessageSquare,
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export default async function ContactConversationPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "message.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to messages.</CardContent>
      </Card>
    );
  }

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: true,
      owner: true,
      communications: { include: { author: true }, orderBy: { occurredAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!contact) notFound();

  const hiringActivity = contact.companyId
    ? await getCompanyHiringActivity(db, contact.companyId)
    : { activeDrives: 0, completedDrives: 0, studentsHired: 0, offersMade: 0, hiringHistory: [] as { year: number; studentsHired: number }[] };

  const activeDrives = contact.companyId
    ? await db.drive.findMany({
        where: { companyId: contact.companyId, status: { in: [...ACTIVE_DRIVE_STATUSES] } },
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const lastCommunicationAt = contact.communications[0]?.occurredAt ?? null;
  const relationshipScore = computeRelationshipScore({
    lastCommunicationAt,
    activeDriveCount: hiringActivity.activeDrives,
    studentsHiredCount: hiringActivity.studentsHired,
    nextFollowUpAt: contact.nextFollowUpAt,
  });

  const name = contact.name ?? "Unnamed contact";
  // Fetched newest-first (for relationship-score recency logic above);
  // displayed oldest-first so the log reads top-to-bottom like a timeline.
  const timeline = [...contact.communications].reverse();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 2xl:flex-row 2xl:gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="-mb-2 -ml-2 w-fit lg:hidden"
          render={<Link href="/messages" />}
        >
          <ArrowLeft className="size-4" /> Back to messages
        </Button>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar size="lg">
              {contact.photoUrl && <AvatarImage src={contact.photoUrl} alt={name} />}
              <AvatarFallback>{initials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="max-w-full truncate text-lg font-semibold tracking-tight">{name}</h1>
                <Badge
                  className={
                    contact.isActive
                      ? "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "border-none bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400"
                  }
                >
                  {contact.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">
                  {RELATIONSHIP_STAGE_LABELS[contact.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? contact.relationshipStage}
                </Badge>
              </div>
              <p className="text-muted-foreground truncate text-sm">
                {[contact.designation, contact.company?.name].filter(Boolean).join(" · ") || "No designation or company set"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contact.email && (
              <Button variant="outline" size="sm" render={<a href={`mailto:${contact.email}`} />}>
                <Mail className="size-3.5" /> Email
              </Button>
            )}
            {contact.phone && (
              <Button variant="outline" size="sm" render={<a href={`tel:${contact.phone}`} />}>
                <Phone className="size-3.5" /> Call
              </Button>
            )}
            <Button variant="outline" size="sm" render={<Link href={`/contacts/${contact.id}`} />}>
              View full Contact 360 <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Honesty caption */}
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            This is a log of communications with this recruiter contact, not a live chat. Messages you log here are saved to
            the contact&apos;s record — they aren&apos;t delivered automatically.
          </p>
        </div>

        {/* Timeline */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {timeline.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                No communication logged yet with {name}.
              </CardContent>
            </Card>
          )}
          {timeline.map((c) => {
            const Icon = COMMUNICATION_ICONS[c.type] ?? StickyNote;
            return (
              <div key={c.id} className="flex gap-3 rounded-lg border px-3 py-2.5">
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {COMMUNICATION_LABELS[c.type] ?? c.type}
                      {c.subject ? ` · ${c.subject}` : ""}
                    </span>
                    <span className="text-muted-foreground text-xs">{timeAgo(c.occurredAt.toISOString())}</span>
                  </div>
                  {c.body && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{c.body}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">Logged by {c.author.name}</p>
                </div>
              </div>
            );
          })}
        </div>

        <ContactConversationComposer contactId={contact.id} />
      </div>

      <aside className="w-full shrink-0 overflow-y-auto border-t pt-3 2xl:w-80 2xl:border-t-0 2xl:border-l 2xl:pt-0 2xl:pl-4">
        <ContextPanel
          kind="contact"
          contact={{
            id: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            location: contact.location,
            linkedinUrl: contact.linkedinUrl,
            designation: contact.designation,
            department: contact.department,
            photoUrl: contact.photoUrl,
            companyName: contact.company?.name ?? null,
            isActive: contact.isActive,
            relationshipStage: contact.relationshipStage,
            ownerName: contact.owner?.name ?? null,
            relationshipSince: contact.relationshipSince ? contact.relationshipSince.toISOString() : null,
            relationshipScore,
            activeDrives: activeDrives.map((d: { id: string; title: string; status: string }) => ({
              id: d.id,
              title: d.title,
              status: d.status,
            })),
            notes: contact.notes.map((n: { id: string; body: string; createdAt: Date }) => ({
              id: n.id,
              body: n.body,
              createdAt: n.createdAt.toISOString(),
            })),
          }}
        />
      </aside>
    </div>
  );
}
