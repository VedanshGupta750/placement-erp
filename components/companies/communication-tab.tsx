import { Mail, Phone, Users, StickyNote, MessageSquare } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogCompanyCommunicationDialog } from "@/components/companies/log-company-communication-dialog";

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

function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
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

// Aggregated communication timeline across ALL of this company's
// recruiters — mirrors the visual style of the single-contact timeline on
// Contact 360 (app/(dashboard)/contacts/[id]/page.tsx) but rolled up to
// company scope.
export async function CommunicationTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [communications, contacts, canEdit] = await Promise.all([
    db.contactCommunication.findMany({
      where: { contact: { companyId } },
      include: { contact: { select: { name: true } }, author: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    db.contact.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    hasPermission(session, "company.edit"),
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Communication ({communications.length})</CardTitle>
        {canEdit && <LogCompanyCommunicationDialog contacts={contacts} />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {communications.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-sm">No communication logged with this company yet.</p>
        )}
        {communications.map((c: {
          id: string;
          type: string;
          subject: string | null;
          body: string | null;
          occurredAt: Date;
          contact: { name: string | null };
          author: { name: string };
        }) => {
          const Icon = COMMUNICATION_ICONS[c.type] ?? StickyNote;
          return (
            <div key={c.id} className="flex gap-3 rounded-lg border px-3 py-2.5">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" />
              </span>
              <div className="flex-1 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {COMMUNICATION_LABELS[c.type] ?? c.type}
                    {c.subject ? ` · ${c.subject}` : ""}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">{timeAgo(c.occurredAt)}</span>
                </div>
                {c.body && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{c.body}</p>}
                <p className="text-muted-foreground mt-1 text-xs">
                  With {c.contact.name ?? "Unnamed contact"} · Logged by {c.author.name}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
