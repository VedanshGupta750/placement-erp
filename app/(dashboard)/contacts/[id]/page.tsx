import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  ExternalLink,
  Users,
  FileCheck2,
  Gauge,
  Briefcase,
  MapPin,
  Building2,
  Calendar,
  StickyNote,
  Clock,
  History,
  MessageSquare,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { getCompanyHiringActivity } from "@/lib/contacts/stats";
import { computeRelationshipScore } from "@/lib/contacts/relationship-score";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ContactPhotoUpload } from "@/components/contacts/contact-photo-upload";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { SetFollowUpDialog } from "@/components/contacts/set-follow-up-dialog";
import { MarkFollowUpCompleteButton } from "@/components/contacts/mark-follow-up-complete-button";
import { LogCommunicationDialog } from "@/components/contacts/log-communication-dialog";
import { ContactNotesPanel } from "@/components/contacts/contact-notes-panel";
import { DeleteContactButton } from "@/components/contacts/delete-contact-button";
import { ContactTagsEditor } from "@/components/contacts/contact-tags-editor";
import { ContactDocumentsPanel } from "@/components/contacts/contact-documents-panel";
import { AiInsightCard } from "@/components/contacts/ai-insight-card";

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

function scoreTheme(label: "Strong" | "Moderate" | "Needs Attention") {
  if (label === "Strong") return "text-emerald-600 dark:text-emerald-400";
  if (label === "Moderate") return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [contact, users] = await Promise.all([
    db.contact.findUnique({
      where: { id },
      include: {
        company: true,
        owner: true,
        addedBy: true,
        communications: { include: { author: true }, orderBy: { occurredAt: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
        history: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    db.user.findMany({
      where: { userType: { not: "STUDENT" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!contact) notFound();

  const canEdit = await hasPermission(session, "company.edit");

  const hiringActivity = contact.companyId
    ? await getCompanyHiringActivity(db, contact.companyId)
    : { activeDrives: 0, completedDrives: 0, studentsHired: 0, offersMade: 0, hiringHistory: [] as { year: number; studentsHired: number }[] };

  const drives = contact.companyId
    ? await db.drive.findMany({
        where: { companyId: contact.companyId },
        include: { _count: { select: { applications: true, offers: true } } },
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
  const now = new Date();
  const followUpOverdue = contact.nextFollowUpAt ? contact.nextFollowUpAt.getTime() < now.getTime() : false;
  const followUpDateForInput = contact.nextFollowUpAt ? contact.nextFollowUpAt.toISOString().slice(0, 10) : null;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/contacts" />}>
        <ArrowLeft className="size-3.5" /> Back to contacts
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <ContactPhotoUpload contactId={contact.id} name={name} photoUrl={contact.photoUrl} canEdit={canEdit} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <Badge className={contact.isActive ? "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "border-none bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400"}>
                {contact.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">{RELATIONSHIP_STAGE_LABELS[contact.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? contact.relationshipStage}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
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
          <Button variant="outline" size="sm" render={<Link href={`/messages/contact/${contact.id}`} />}>
            <MessageSquare className="size-3.5" /> Message
          </Button>
          {canEdit && (
            <SetFollowUpDialog
              contactId={contact.id}
              initialDate={followUpDateForInput}
              initialNote={contact.nextFollowUpNote}
            />
          )}
          {canEdit && (
            <EditContactDialog
              contact={{
                id: contact.id,
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                contactType: contact.contactType,
                designation: contact.designation,
                department: contact.department,
                location: contact.location,
                linkedinUrl: contact.linkedinUrl,
                relationshipStage: contact.relationshipStage,
                ownerId: contact.ownerId,
                isActive: contact.isActive,
              }}
              users={users}
            />
          )}
          {canEdit && <DeleteContactButton contactId={contact.id} contactName={name} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Briefcase} label="Active Drives" value={hiringActivity.activeDrives} color="blue" />
        <StatCard icon={Users} label="Students Hired" value={hiringActivity.studentsHired} color="emerald" />
        <StatCard icon={FileCheck2} label="Offers Made" value={hiringActivity.offersMade} color="amber" />
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <div className="flex items-center gap-2">
              <div className="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 flex size-11 shrink-0 items-center justify-center rounded-full">
                <Gauge className="size-5" />
              </div>
              <div>
                <div className="text-muted-foreground text-sm">Relationship Score</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold tabular-nums ${scoreTheme(relationshipScore.label)}`}>{relationshipScore.score}</span>
                  <Badge variant="secondary" className="border-none">{relationshipScore.label}</Badge>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">System-generated relationship indicator</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-fit justify-start gap-6 border-b px-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="drives">Drives ({drives.length})</TabsTrigger>
          <TabsTrigger value="communication">Communication ({contact.communications.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({contact.notes.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({contact.documents.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({contact.history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <AiInsightCard contactId={contact.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y text-sm">
              {contact.email && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Email</span>
                  <a href={`mailto:${contact.email}`} className="text-primary flex items-center gap-2 hover:underline">
                    <Mail className="size-4" /> {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Phone</span>
                  <span className="flex items-center gap-2">
                    <Phone className="text-muted-foreground size-4" /> {contact.phone}
                  </span>
                </div>
              )}
              {contact.linkedinUrl && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">LinkedIn</span>
                  <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-2 hover:underline">
                    <ExternalLink className="size-4" /> {contact.linkedinUrl}
                  </a>
                </div>
              )}
              {contact.designation && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Designation</span>
                  <span>{contact.designation}</span>
                </div>
              )}
              {contact.department && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Department</span>
                  <span>{contact.department}</span>
                </div>
              )}
              {contact.location && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Location</span>
                  <span className="flex items-center gap-2">
                    <MapPin className="text-muted-foreground size-4" /> {contact.location}
                  </span>
                </div>
              )}
              {contact.company && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Company</span>
                  <Link href={`/companies/${contact.company.id}`} className="text-primary flex items-center gap-2 hover:underline">
                    <Building2 className="size-4" /> {contact.company.name}
                  </Link>
                </div>
              )}
              {!contact.email && !contact.phone && !contact.linkedinUrl && !contact.designation && !contact.department && !contact.location && !contact.company && (
                <p className="text-muted-foreground py-3 first:pt-0">No contact details on file yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relationship</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y text-sm">
              <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                <span className="text-muted-foreground text-xs">Owner</span>
                <span>{contact.owner?.name ?? "Unassigned"}</span>
              </div>
              <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                <span className="text-muted-foreground text-xs">Relationship Since</span>
                <span>{contact.relationshipSince ? new Date(contact.relationshipSince).toLocaleDateString("en-IN") : "—"}</span>
              </div>
              <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                <span className="text-muted-foreground text-xs">Relationship Stage</span>
                <Badge variant="outline" className="w-fit">{RELATIONSHIP_STAGE_LABELS[contact.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? contact.relationshipStage}</Badge>
              </div>
              <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                <span className="text-muted-foreground text-xs">Added by</span>
                <span>{contact.addedBy?.name ?? "—"}</span>
              </div>
              {!contact.companyId && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Hiring activity</span>
                  <span className="text-muted-foreground">Not linked to a company.</span>
                </div>
              )}
              {contact.companyId && hiringActivity.hiringHistory.length > 0 && (
                <div className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <span className="text-muted-foreground text-xs">Hiring history</span>
                  <div className="flex flex-wrap gap-1.5">
                    {hiringActivity.hiringHistory.map((h) => (
                      <Badge key={h.year} variant="outline">{h.year}: {h.studentsHired} hired</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next Follow-up</CardTitle>
            </CardHeader>
            <CardContent>
              {contact.nextFollowUpAt ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`flex items-center gap-2 font-medium ${followUpOverdue ? "text-rose-600 dark:text-rose-400" : ""}`}>
                      <Clock className="size-4" />
                      {new Date(contact.nextFollowUpAt).toLocaleString("en-IN")}
                      {followUpOverdue && <Badge variant="destructive">Overdue</Badge>}
                    </div>
                    {contact.nextFollowUpNote && <p className="text-muted-foreground mt-1 text-sm">{contact.nextFollowUpNote}</p>}
                  </div>
                  {canEdit && <MarkFollowUpCompleteButton contactId={contact.id} />}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-muted-foreground text-sm">No follow-up scheduled.</p>
                  {canEdit && (
                    <SetFollowUpDialog
                      contactId={contact.id}
                      triggerLabel={<><Calendar className="size-3.5" /> Schedule follow-up</>}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactTagsEditor contactId={contact.id} tags={contact.tags} canEdit={canEdit} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drives" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {!contact.companyId && (
                <p className="text-muted-foreground py-6 text-center text-sm">This contact isn&apos;t linked to a company, so no drives to show.</p>
              )}
              {contact.companyId && drives.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">No drives yet for {contact.company?.name}.</p>
              )}
              {drives.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs">
                        <th className="pb-2 font-medium">Drive</th>
                        <th className="pb-2 font-medium">Year</th>
                        <th className="pb-2 font-medium">Applications</th>
                        <th className="pb-2 font-medium">Offers</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {drives.map((d: { id: string; title: string; createdAt: Date; status: string; _count: { applications: number; offers: number } }) => (
                        <tr key={d.id}>
                          <td className="py-2.5">
                            <Link href={`/drives/${d.id}`} className="text-primary hover:underline">{d.title}</Link>
                          </td>
                          <td className="py-2.5">{new Date(d.createdAt).getFullYear()}</td>
                          <td className="py-2.5">{d._count.applications}</td>
                          <td className="py-2.5">{d._count.offers}</td>
                          <td className="py-2.5"><StatusBadge status={d.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication" className="mt-4">
          <div className="mb-4 flex justify-end">
            {canEdit && <LogCommunicationDialog contactId={contact.id} />}
          </div>
          <div className="flex flex-col gap-3">
            {contact.communications.map((c: { id: string; type: string; subject: string | null; body: string | null; occurredAt: Date; author: { name: string } }) => {
              const Icon = COMMUNICATION_ICONS[c.type] ?? StickyNote;
              return (
                <div key={c.id} className="flex gap-3 rounded-lg border px-3 py-2.5">
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{COMMUNICATION_LABELS[c.type] ?? c.type}{c.subject ? ` · ${c.subject}` : ""}</span>
                      <span className="text-muted-foreground text-xs">{timeAgo(c.occurredAt.toISOString())}</span>
                    </div>
                    {c.body && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{c.body}</p>}
                    <p className="text-muted-foreground mt-1 text-xs">Logged by {c.author.name}</p>
                  </div>
                </div>
              );
            })}
            {contact.communications.length === 0 && (
              <Card>
                <CardContent className="text-muted-foreground py-10 text-center text-sm">No communication logged yet.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ContactNotesPanel
                contactId={contact.id}
                canEdit={canEdit}
                notes={contact.notes.map((n: { id: string; body: string; createdAt: Date; author: { name: string } }) => ({
                  id: n.id,
                  body: n.body,
                  createdAt: n.createdAt.toISOString(),
                  author: { name: n.author.name },
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ContactDocumentsPanel
                contactId={contact.id}
                canEdit={canEdit}
                documents={contact.documents.map((d: { id: string; fileName: string; mimeType: string; sizeBytes: number; dataUrl: string; createdAt: Date; uploadedBy: { name: string } | null }) => ({
                  id: d.id,
                  fileName: d.fileName,
                  mimeType: d.mimeType,
                  sizeBytes: d.sizeBytes,
                  dataUrl: d.dataUrl,
                  createdAt: d.createdAt.toISOString(),
                  uploadedBy: d.uploadedBy ? { name: d.uploadedBy.name } : null,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="flex flex-col gap-3">
            {contact.history.map((h: { id: string; action: string; createdAt: Date; actor: { name: string } }) => (
              <div key={h.id} className="flex gap-3 rounded-lg border px-3 py-2.5">
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                  <History className="size-4" />
                </span>
                <div className="flex-1 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{h.action}</span>
                    <span className="text-muted-foreground text-xs">{timeAgo(h.createdAt.toISOString())}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">by {h.actor.name} · {new Date(h.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
            {contact.history.length === 0 && (
              <Card>
                <CardContent className="text-muted-foreground py-10 text-center text-sm">No activity recorded yet.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
