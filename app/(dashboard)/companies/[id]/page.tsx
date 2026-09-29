import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PartnershipStatusBadge } from "@/components/companies/partnership-status-badge";
import { CompanyHeaderActions } from "@/components/companies/company-header-actions";
import { OverviewTab } from "@/components/companies/overview-tab";
import { TalentInsightsTab } from "@/components/companies/talent-insights-tab";
import { RecruitersTab } from "@/components/companies/recruiters-tab";
import { DrivesTab } from "@/components/companies/drives-tab";
import { ApplicationsTab } from "@/components/companies/applications-tab";
import { InterviewsTab } from "@/components/companies/interviews-tab";
import { OffersTab } from "@/components/companies/offers-tab";
import { EventsTab } from "@/components/companies/events-tab";
import { CommunicationTab } from "@/components/companies/communication-tab";
import { DocumentsTab } from "@/components/companies/documents-tab";
import { ActivityTab } from "@/components/companies/activity-tab";
import { NotesTab } from "@/components/companies/notes-tab";
import { CompanyEligibilityTab } from "@/components/companies/eligibility-tab";

// Company 360 — same architecture as the Event 360 / Student 360 pages:
// every tab below is a self-contained async server component taking only
// `{companyId}` and fetching its own data, so each can be built/changed
// independently without touching this shared shell.
export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // company.view isn't held by Student (see lib/rbac/permissions.ts) —
  // same gap/fix as drives/[id]/page.tsx: this page had no gate at all
  // before this fix, found via the same low-privilege-role test.
  const canView = await hasPermission(session, "company.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this company.</CardContent>
      </Card>
    );
  }

  const partnership = await db.collegePartnership.findFirst({ where: { companyId: id } });
  if (!partnership) notFound();

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) notFound();

  const [canEdit, primaryContact] = await Promise.all([
    hasPermission(session, "company.edit"),
    db.contact.findFirst({ where: { companyId: id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/companies" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to companies
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="mt-1 size-12 shrink-0 rounded-lg border object-contain" />
          ) : (
            <div className="bg-accent mt-1 flex size-12 shrink-0 items-center justify-center rounded-lg">
              <Building2 className="text-muted-foreground size-6" />
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              <PartnershipStatusBadge status={partnership.status} />
            </div>
            <p className="text-muted-foreground text-sm">
              {company.industryType ?? "—"}
              {company.headquarters && ` · ${company.headquarters}`}
              {partnership.connectedAt && ` · Partner since ${new Date(partnership.connectedAt).getFullYear()}`}
            </p>
          </div>
        </div>
        <CompanyHeaderActions
          companyId={company.id}
          companyName={company.name}
          status={partnership.status}
          primaryContactId={primaryContact?.id ?? null}
          canEdit={canEdit}
          initial={{
            legalName: company.legalName,
            website: company.website,
            industryType: company.industryType,
            headquarters: company.headquarters,
            linkedinUrl: company.linkedinUrl,
            about: company.about,
            size: company.size,
            hiringType: company.hiringType,
          }}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="talent-insights">Talent Insights</TabsTrigger>
          <TabsTrigger value="recruiters">Recruiters</TabsTrigger>
          <TabsTrigger value="drives">Drives</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab companyId={company.id} /></TabsContent>
        <TabsContent value="talent-insights" className="mt-4"><TalentInsightsTab companyId={company.id} /></TabsContent>
        <TabsContent value="recruiters" className="mt-4"><RecruitersTab companyId={company.id} /></TabsContent>
        <TabsContent value="drives" className="mt-4"><DrivesTab companyId={company.id} /></TabsContent>
        <TabsContent value="applications" className="mt-4"><ApplicationsTab companyId={company.id} /></TabsContent>
        <TabsContent value="eligibility" className="mt-4"><CompanyEligibilityTab companyId={company.id} /></TabsContent>
        <TabsContent value="interviews" className="mt-4"><InterviewsTab companyId={company.id} /></TabsContent>
        <TabsContent value="offers" className="mt-4"><OffersTab companyId={company.id} /></TabsContent>
        <TabsContent value="events" className="mt-4"><EventsTab companyId={company.id} /></TabsContent>
        <TabsContent value="communication" className="mt-4"><CommunicationTab companyId={company.id} /></TabsContent>
        <TabsContent value="documents" className="mt-4"><DocumentsTab companyId={company.id} /></TabsContent>
        <TabsContent value="notes" className="mt-4"><NotesTab companyId={company.id} /></TabsContent>
        <TabsContent value="activity" className="mt-4"><ActivityTab companyId={company.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
