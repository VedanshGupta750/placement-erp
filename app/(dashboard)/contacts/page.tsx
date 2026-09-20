import Link from "next/link";
import { Contact as ContactIcon, UserCheck, Clock3, Building2, Download, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { ContactsFilterPanel } from "@/components/contacts/contacts-filter-panel";
import { ContactsTable, type ContactRow } from "@/components/contacts/contacts-table";
import { RelationshipStageFunnel } from "@/components/contacts/relationship-stage-funnel";
import { getContactListStats, getRelationshipStageBreakdown } from "@/lib/contacts/stats";
import { cn } from "@/lib/utils";

const ACTIVE_DRIVE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SELECTION_ONGOING"] as const;

type SearchParams = {
  q?: string;
  companyId?: string;
  contactType?: string;
  relationshipStage?: string;
  ownerId?: string;
  status?: string;
  tags?: string;
  followUpStatus?: string;
  tab?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function followUpDisplay(nextFollowUpAt: Date | null) {
  if (!nextFollowUpAt) return { text: "—", className: "text-muted-foreground" };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const d = new Date(nextFollowUpAt);
  if (d < startOfToday) return { text: "Overdue", className: "font-medium text-rose-600 dark:text-rose-400" };
  if (d <= endOfToday) return { text: "Due today", className: "font-medium text-amber-600 dark:text-amber-400" };
  return { text: d.toLocaleDateString("en-IN"), className: "text-muted-foreground" };
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const canManage = await hasPermission(session, "company.create");

  const where: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];
  if (params.q) {
    andConditions.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { email: { contains: params.q, mode: "insensitive" } },
        { company: { name: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }
  if (params.companyId) where.companyId = params.companyId;
  if (params.contactType) where.contactType = params.contactType;
  if (params.relationshipStage) where.relationshipStage = params.relationshipStage;
  if (params.ownerId) where.ownerId = params.ownerId === "__unassigned__" ? null : params.ownerId;
  if (params.status === "active") where.isActive = true;
  else if (params.status === "inactive") where.isActive = false;
  if (params.tags) where.tags = { hasSome: params.tags.split(",").map((t) => t.trim()).filter(Boolean) };
  if (params.followUpStatus) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (params.followUpStatus === "overdue") where.nextFollowUpAt = { lt: startOfToday };
    else if (params.followUpStatus === "today") where.nextFollowUpAt = { gte: startOfToday, lte: endOfToday };
    else if (params.followUpStatus === "upcoming") where.nextFollowUpAt = { gt: endOfToday };
    else if (params.followUpStatus === "none") where.nextFollowUpAt = null;
  }

  if (params.tab === "mine") {
    where.ownerId = session.userId;
  } else if (params.tab === "followups") {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    where.nextFollowUpAt = { lte: endOfDay };
  } else if (params.tab === "active") {
    where.isActive = true;
  } else if (params.tab === "dormant") {
    andConditions.push({ OR: [{ isActive: false }, { relationshipStage: "DORMANT" }] });
  }

  if (andConditions.length) where.AND = andConditions;

  const currentPage = Math.max(1, Number(params.page) || 1);

  const [contacts, totalMatching, companies, users, stats, stageBreakdown] = await Promise.all([
    db.contact.findMany({
      where,
      include: { company: true, owner: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.contact.count({ where }),
    db.company.findMany({ where: { partnerships: { some: { collegeId: session.collegeId } } }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { userType: { not: "STUDENT" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getContactListStats(db),
    getRelationshipStageBreakdown(db),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  // Batched (as in: one query per company, not one per row) drive counts to
  // avoid N+1 queries — scoped to the active admission batch the same way
  // Companies/Applications/Offers are.
  const activeBatchId = await getActiveBatchId();
  const companyIds = [...new Set(contacts.map((c: { companyId: string | null }) => c.companyId).filter((id: string | null): id is string => !!id))];
  const driveCounts = new Map<string, number>();
  await Promise.all(
    companyIds.map(async (companyId: string) => {
      const count = await db.drive.count({ where: { companyId, status: { in: [...ACTIVE_DRIVE_STATUSES] }, ...(activeBatchId ? { batchId: activeBatchId } : {}) } });
      driveCounts.set(companyId, count);
    }),
  );

  // One query for the latest communication per contact (distinct + orderBy desc returns the first row per group).
  const contactIds = contacts.map((c: { id: string }) => c.id);
  const latestCommunications = contactIds.length
    ? await db.contactCommunication.findMany({
        where: { contactId: { in: contactIds } },
        orderBy: { occurredAt: "desc" },
        distinct: ["contactId"],
        select: { contactId: true, occurredAt: true },
      })
    : [];
  const lastContactByContactId = new Map<string, Date>(
    latestCommunications.map((c: { contactId: string; occurredAt: Date }) => [c.contactId, c.occurredAt]),
  );

  const tabs = [
    { key: undefined, label: "All Contacts" },
    { key: "mine", label: "My Contacts" },
    { key: "followups", label: "Follow-ups Due", badge: stats.followUpsDueToday },
    { key: "active", label: "Active Recruiters" },
    { key: "dormant", label: "Dormant" },
  ] as const;

  function tabHref(key: string | undefined) {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.companyId) p.set("companyId", params.companyId);
    if (params.contactType) p.set("contactType", params.contactType);
    if (params.relationshipStage) p.set("relationshipStage", params.relationshipStage);
    if (params.ownerId) p.set("ownerId", params.ownerId);
    if (params.status) p.set("status", params.status);
    if (params.tags) p.set("tags", params.tags);
    if (params.followUpStatus) p.set("followUpStatus", params.followUpStatus);
    if (key) p.set("tab", key);
    const qs = p.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  }

  function pageHref(page: number) {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.companyId) p.set("companyId", params.companyId);
    if (params.contactType) p.set("contactType", params.contactType);
    if (params.relationshipStage) p.set("relationshipStage", params.relationshipStage);
    if (params.ownerId) p.set("ownerId", params.ownerId);
    if (params.status) p.set("status", params.status);
    if (params.tags) p.set("tags", params.tags);
    if (params.followUpStatus) p.set("followUpStatus", params.followUpStatus);
    if (params.tab) p.set("tab", params.tab);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground text-sm">Manage recruiter relationships, communication history and follow-ups.</p>
        </div>
        <div className="-mx-4 flex overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" render={<Link href="/api/contacts/export" />}>
            <Download className="size-4" /> Export CSV
          </Button>
          {canManage && (
            <Button variant="outline" render={<Link href="/contacts/import" />}>
              <Upload className="size-4" /> Import CSV
            </Button>
          )}
          {canManage && (
            <CreateContactDialog
              companies={companies.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
              users={users}
            />
          )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-4">
        <StatCard icon={ContactIcon} label="Total Contacts" value={stats.totalContacts} color="blue" />
        <StatCard icon={UserCheck} label="Active Recruiters" value={stats.activeContacts} color="emerald" />
        <StatCard icon={Clock3} label="Follow-ups Due" value={stats.followUpsDueToday} sublabel="today" color="amber" />
        <StatCard icon={Building2} label="Companies Covered" value={stats.companiesCovered} color="violet" />
      </div>

      <RelationshipStageFunnel breakdown={stageBreakdown} activeStage={params.relationshipStage} />

      <div className="flex max-w-full w-fit gap-1 overflow-x-auto overscroll-x-contain rounded-lg border p-1 [scrollbar-width:thin]">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={tabHref(t.key)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              (params.tab ?? undefined) === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
            {"badge" in t && t.badge > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex size-4 items-center justify-center rounded-full text-[10px]",
                  (params.tab ?? undefined) === t.key ? "bg-primary-foreground/20" : "bg-muted-foreground/20",
                )}
              >
                {t.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <form className="w-full min-w-0 sm:flex-1">
              {params.tab && <input type="hidden" name="tab" value={params.tab} />}
              {params.companyId && <input type="hidden" name="companyId" value={params.companyId} />}
              {params.contactType && <input type="hidden" name="contactType" value={params.contactType} />}
              {params.relationshipStage && <input type="hidden" name="relationshipStage" value={params.relationshipStage} />}
              {params.ownerId && <input type="hidden" name="ownerId" value={params.ownerId} />}
              {params.status && <input type="hidden" name="status" value={params.status} />}
              {params.tags && <input type="hidden" name="tags" value={params.tags} />}
              {params.followUpStatus && <input type="hidden" name="followUpStatus" value={params.followUpStatus} />}
              <Input name="q" placeholder="Search by name, email, or company…" defaultValue={params.q} className="w-full sm:max-w-sm" />
            </form>
            <ContactsFilterPanel
              companies={companies.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
              users={users}
            />
          </div>

          <ContactsTable
            canManage={canManage}
            users={users}
            contacts={contacts.map((c: {
              id: string;
              name: string | null;
              photoUrl: string | null;
              email: string | null;
              phone: string | null;
              companyId: string | null;
              company: { name: string } | null;
              contactType: string | null;
              nextFollowUpAt: Date | null;
              owner: { name: string } | null;
            }): ContactRow => {
              const followUp = followUpDisplay(c.nextFollowUpAt);
              const lastContact = lastContactByContactId.get(c.id);
              return {
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                photoUrl: c.photoUrl,
                companyName: c.company?.name ?? null,
                contactType: c.contactType,
                driveCount: c.companyId ? (driveCounts.get(c.companyId) ?? 0) : 0,
                lastContactText: lastContact ? lastContact.toLocaleDateString("en-IN") : "—",
                followUpText: followUp.text,
                followUpClassName: followUp.className,
                ownerName: c.owner?.name ?? "Unassigned",
              };
            })}
          />

          {totalMatching > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalMatching)} of {totalMatching}
              </p>
              <div className="flex items-center gap-2">
                {currentPage <= 1 ? (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="size-3.5" /> Previous
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" render={<Link href={pageHref(currentPage - 1)} />}>
                    <ChevronLeft className="size-3.5" /> Previous
                  </Button>
                )}
                <span className="text-muted-foreground text-sm">Page {currentPage} of {totalPages}</span>
                {currentPage >= totalPages ? (
                  <Button variant="outline" size="sm" disabled>
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" render={<Link href={pageHref(currentPage + 1)} />}>
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
