import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, FileCheck2, ListChecks, Video, CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DriveActions } from "@/components/drives/drive-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { ApplicantsPanel } from "@/components/drives/applicants-panel";
import { EligibilityPanel } from "@/components/drives/eligibility-panel";
import { EligibilityOverridesPanel } from "@/components/drives/eligibility-overrides-panel";
import { OffersPanel } from "@/components/drives/offers-panel";
import { RoundsPanel } from "@/components/drives/rounds-panel";
import { AttachmentsPanel } from "@/components/drives/attachments-panel";
import { NotesPanel } from "@/components/drives/notes-panel";
import { HistoryTrailPanel } from "@/components/drives/history-trail-panel";
import { ApplicationFieldsPanel } from "@/components/drives/application-fields-panel";
import { PositionsPanel } from "@/components/drives/positions-panel";
import { JoiningPanel } from "@/components/drives/joining-panel";
import { CommunicationsPanel } from "@/components/drives/communications-panel";
import { DriveHealthCard } from "@/components/drives/drive-health-card";
import { ShortlistingPanel } from "@/components/drives/shortlisting-panel";
import { AssessmentsPanel } from "@/components/drives/assessments-panel";
import { hasPermission } from "@/lib/rbac/guard";
import { PLACED_OFFER_STATUSES } from "@/lib/students/placement";
import { describeCondition, type EligibilityCheck, type EligibilityField, type EligibilityOperator } from "@/lib/eligibility";
import { getActiveOverrides } from "@/lib/eligibility-runner";
import { EligibilityResultsPanel } from "@/components/drives/eligibility-results-panel";

function daysUntil(target: Date) {
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

// Tab values usable as ?tab= — listed explicitly so an unknown or stale
// value falls back to Overview instead of rendering an empty Tabs panel.
const DRIVE_TABS = [
  "overview",
  "positions",
  "eligibility",
  "applicants",
  "shortlisting",
  "assessments",
  "rounds",
  "offers",
  "joining",
  "documents",
  "communications",
  "notes",
  "history",
] as const;

export default async function DriveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const initialTab = DRIVE_TABS.includes(requestedTab as (typeof DRIVE_TABS)[number]) ? requestedTab! : "overview";
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // drive.view isn't held by Student (see lib/rbac/permissions.ts) — same
  // pattern as interview.view. This page had NO gate at all before this
  // fix: any logged-in student could open any drive's full management
  // view directly by URL (every other applicant's data, offer amounts,
  // and Close/Suspend/Mark-complete drive actions), found via the
  // low-privilege-role test this session has repeatedly used to catch
  // this exact bug class elsewhere (Applications, and 8 pages with zero
  // gate at all, earlier this session).
  const canView = await hasPermission(session, "drive.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this drive.</CardContent>
      </Card>
    );
  }

  const drive = await db.drive.findUnique({
    where: { id },
    include: {
      company: true,
      batch: { select: { year: true } },
      positions: true,
      eligibleCourses: { include: { course: true } },
      requiredSkills: { include: { skill: true } },
      applications: {
        include: {
          student: { include: { user: true } },
          fieldValues: { include: { field: true } },
          // Resume snapshot taken at apply time — surfaced straight in the
          // applicants list so screening doesn't need one page per candidate.
          resume: { select: { name: true, file: { select: { dataUrl: true, originalName: true } } } },
        },
        orderBy: { matchScore: "desc" },
      },
      offers: { include: { student: { include: { user: true } } } },
      eligibilityRules: { orderBy: { version: "desc" } },
      eligibilitySnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      rounds: { include: { candidates: { include: { student: { include: { user: true } } } } }, orderBy: { sequenceNo: "asc" } },
      documents: { include: { file: true }, orderBy: { createdAt: "desc" } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      historyEntries: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      applicationFields: { orderBy: { order: "asc" } },
    },
  });
  if (!drive) notFound();
  const [canEditDrive, canMarkJoined, canOverrideEligibility, conversations, allSkills, eligibilityOverrides, activeOverrides] = await Promise.all([
    hasPermission(session, "drive.edit"),
    hasPermission(session, "offer.mark_joined"),
    hasPermission(session, "eligibility.override"),
    db.conversation.findMany({ where: { driveId: id }, orderBy: { createdAt: "desc" } }),
    db.skill.findMany({ orderBy: { name: "asc" } }),
    db.eligibilityOverride.findMany({
      where: { driveId: id },
      include: { student: { select: { enrollmentNumber: true, user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    getActiveOverrides(db, id),
  ]);
  const position = drive.positions[0];
  const selectedWithoutOffer = drive.applications.filter((a) => a.status === "SELECTED" && !drive.offers.some((o) => o.applicationId === a.id));
  const latestSnapshot = drive.eligibilitySnapshots[0];

  // The named roster behind the counts; the summary's eligible/not-eligible
  // totals are derived from these rows, so there is no separate count query.
  // `explanation` is the frozen check array captured at publish time, so the
  // exclusion reason shown is the one that actually applied then — not a
  // re-evaluation against today's data.
  const snapshotResults = latestSnapshot
    ? await db.eligibilityResult.findMany({
        where: { snapshotId: latestSnapshot.id },
        include: { student: { select: { id: true, enrollmentNumber: true, aggregate: true, liveBacklogs: true, user: { select: { name: true, email: true } }, course: { select: { name: true } }, department: { select: { name: true } } } } },
      })
    : [];
  // An override takes effect the moment it is saved, not at the next
  // publish: the snapshot stays the frozen record of what the RULE decided,
  // and the override is layered on top for the verdict actually shown. That
  // is the same order lib/eligibility-runner.ts applies them in, so this
  // roster and the next publish agree.
  // Who has already filled this drive's form, and who is already placed
  // elsewhere. Both are joined onto the eligibility roster so the single
  // "registration is open — who do I still need to chase?" question can be
  // answered in one place, instead of cross-referencing three tabs.
  const appliedStudentIds = new Set(drive.applications.map((a) => a.studentId));
  const placingOffers = await db.offer.findMany({
    where: {
      studentId: { in: snapshotResults.map((r) => r.student.id) },
      status: { in: [...PLACED_OFFER_STATUSES] },
    },
    select: { studentId: true, drive: { select: { company: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const placedCompanyByStudent = new Map<string, string>();
  for (const o of placingOffers) {
    if (!placedCompanyByStudent.has(o.studentId)) placedCompanyByStudent.set(o.studentId, o.drive.company.name);
  }

  const eligibilityResultRows = snapshotResults
    .map((r) => {
      const checks = (r.explanation ?? []) as { field: EligibilityField; operator: EligibilityOperator; expected: unknown; actual: unknown; passed: boolean }[];
      const firstFailed = Array.isArray(checks) ? checks.find((c) => !c.passed) : undefined;
      const override = activeOverrides.get(r.student.id);
      return {
        studentId: r.student.id,
        name: r.student.user.name,
        enrollmentNumber: r.student.enrollmentNumber,
        courseName: r.student.course?.name ?? null,
        departmentName: r.student.department?.name ?? null,
        email: r.student.user.email,
        cgpa: r.student.aggregate,
        liveBacklogs: r.student.liveBacklogs,
        eligible: override ? override.decision === "ELIGIBLE" : r.eligible,
        ruleEligible: r.eligible,
        // describeCondition ends with "(passed)"/"(failed)" for log output;
        // the row already shows a red ✗, so drop the redundant suffix.
        failedReason: firstFailed ? describeCondition(firstFailed as EligibilityCheck).replace(/\s*\((passed|failed)\)$/, "") : null,
        overridden: Boolean(override),
        overrideReason: override?.reason ?? null,
        hasApplied: appliedStudentIds.has(r.student.id),
        placedAtCompany: placedCompanyByStudent.get(r.student.id) ?? null,
      };
    })
    .sort((a, b) => Number(a.eligible) - Number(b.eligible) || a.name.localeCompare(b.name));

  // Counts shown in the summary card follow the same effective verdict, so
  // "Not eligible" drops the instant a student is forced in.
  const effectiveEligibleCount = eligibilityResultRows.filter((r) => r.eligible).length;
  const overrideAdjustedCount = eligibilityResultRows.filter((r) => r.overridden && r.eligible !== r.ruleEligible).length;

  const interviewedStudentIds = new Set(drive.rounds.flatMap((r) => r.candidates.map((c) => c.studentId)));
  const totalInterviewSlots = drive.rounds.reduce((sum, r) => sum + r.candidates.length, 0);
  const joinedCount = drive.offers.filter((o) => o.status === "JOINED").length;
  const daysUntilRegistrationCloses = drive.registrationClosesAt ? daysUntil(new Date(drive.registrationClosesAt)) : null;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/drives" />}>
        <ArrowLeft className="size-3.5" /> Back to drives
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{drive.title}</h1>
            <StatusBadge status={drive.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {drive.company.name} · {position?.positionType.replaceAll("_", " ")} · Batch {drive.batch.year}
          </p>
        </div>
        <DriveActions id={drive.id} status={drive.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Applications" value={drive.applications.length} color="blue" />
        <StatCard icon={ListChecks} label="Eligible" value={drive.eligibleCount} color="sky" />
        <StatCard icon={ListChecks} label="Shortlisted" value={drive.shortlistedCount} color="violet" />
        <StatCard icon={Video} label="Interviews" value={interviewedStudentIds.size} color="amber" />
        <StatCard icon={FileCheck2} label="Offers" value={drive.offers.length} color="emerald" />
        <StatCard icon={CheckCircle2} label="Joined" value={joinedCount} color="teal" />
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions ({drive.positions.length})</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="applicants">Applicants ({drive.applications.length})</TabsTrigger>
          <TabsTrigger value="shortlisting">Shortlisting</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="rounds">Interviews ({drive.rounds.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers ({drive.offers.length})</TabsTrigger>
          <TabsTrigger value="joining">Joining</TabsTrigger>
          <TabsTrigger value="documents">Documents ({drive.documents.length})</TabsTrigger>
          <TabsTrigger value="communications">Communications ({conversations.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({drive.notes.length})</TabsTrigger>
          <TabsTrigger value="history">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <DriveHealthCard
            eligibleCount={drive.eligibleCount}
            applications={drive.applications.length}
            shortlisted={drive.shortlistedCount}
            interviewSlotsScheduled={totalInterviewSlots}
            offers={drive.offers.length}
            daysUntilRegistrationCloses={daysUntilRegistrationCloses}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Compensation</div>
                <div className="font-medium">
                  {position?.minCtc ? `₹${(Number(position.minCtc) / 100000).toFixed(1)}L` : "-"}
                  {position?.maxCtc ? ` – ₹${(Number(position.maxCtc) / 100000).toFixed(1)}L` : ""} CTC
                  {position?.stipend ? ` · ₹${Number(position.stipend).toLocaleString("en-IN")}/mo stipend` : ""}
                </div>
              </div>
              {drive.eligibilityCriteria && (
                <div>
                  <div className="text-muted-foreground mb-1">Eligibility criteria</div>
                  <p>{drive.eligibilityCriteria}</p>
                </div>
              )}
              {drive.selectionProcessDetails && (
                <div>
                  <div className="text-muted-foreground mb-1">Selection process</div>
                  <p>{drive.selectionProcessDetails}</p>
                </div>
              )}
              <div>
                <div className="text-muted-foreground mb-1">Eligible courses</div>
                <div className="flex flex-wrap gap-1.5">
                  {drive.eligibleCourses.map((c) => (
                    <Badge key={c.courseId} variant="outline">{c.course.specialization ?? c.course.name}</Badge>
                  ))}
                </div>
              </div>
              {drive.requiredSkills.length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1">Required skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {drive.requiredSkills.map((s) => (
                      <Badge key={s.skillId} variant="outline">{s.skill.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application fields</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationFieldsPanel
                driveId={drive.id}
                canEdit={canEditDrive}
                fields={drive.applicationFields.map((f) => ({ id: f.id, label: f.label, fieldType: f.fieldType, required: f.required }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          <PositionsPanel
            positions={drive.positions.map((p) => ({
              id: p.id,
              title: p.title,
              positionType: p.positionType,
              employmentType: p.employmentType,
              minCtc: p.minCtc,
              maxCtc: p.maxCtc,
              stipend: p.stipend,
              joiningBonus: p.joiningBonus,
              openings: p.openings,
            }))}
            locationCategory={drive.locationCategory}
            skills={drive.requiredSkills.map((s) => ({ skillId: s.skillId, skill: { name: s.skill.name } }))}
          />
        </TabsContent>

        <TabsContent value="applicants" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ApplicantsPanel driveId={drive.id} applicants={drive.applications} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shortlisting" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ShortlistingPanel driveId={drive.id} applicants={drive.applications} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <AssessmentsPanel driveId={drive.id} />
        </TabsContent>

        <TabsContent value="eligibility" className="mt-4">
          <div className="flex flex-col gap-4">
            <EligibilityPanel
              driveId={drive.id}
              rules={drive.eligibilityRules.map((r) => ({ id: r.id, version: r.version, isPublished: r.isPublished, publishedAt: r.publishedAt?.toISOString() ?? null }))}
              latestSnapshot={latestSnapshot ? { studentCount: latestSnapshot.studentCount, eligibleCount: effectiveEligibleCount, overrideAdjustedCount } : null}
              skills={allSkills.map((s) => ({ id: s.id, name: s.name }))}
            />
            <EligibilityResultsPanel results={eligibilityResultRows} />
            <EligibilityOverridesPanel
              driveId={drive.id}
              canOverride={canOverrideEligibility}
              overrides={eligibilityOverrides.map((o) => ({
                id: o.id,
                studentId: o.studentId,
                studentName: o.student.user.name,
                enrollmentNumber: o.student.enrollmentNumber,
                decision: o.decision as "ELIGIBLE" | "NOT_ELIGIBLE",
                reason: o.reason,
                createdAt: o.createdAt.toISOString(),
              }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          <RoundsPanel
            driveId={drive.id}
            rounds={drive.rounds.map((r) => ({
              id: r.id,
              name: r.name,
              roundType: r.roundType,
              sequenceNo: r.sequenceNo,
              status: r.status,
              candidates: r.candidates.map((c) => ({
                id: c.id,
                status: c.status,
                score: c.score,
                scheduledAt: c.scheduledAt?.toISOString() ?? null,
                student: { user: { name: c.student.user.name } },
              })),
            }))}
          />
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          <OffersPanel
            driveId={drive.id}
            offers={drive.offers.map((o) => ({ id: o.id, status: o.status, totalCompensation: o.totalCompensation.toString(), student: o.student }))}
            selectedWithoutOffer={selectedWithoutOffer}
          />
        </TabsContent>

        <TabsContent value="joining" className="mt-4">
          <JoiningPanel
            driveId={drive.id}
            offers={drive.offers.map((o) => ({ id: o.id, status: o.status, student: o.student }))}
            canMarkJoined={canMarkJoined}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsPanel
                driveId={drive.id}
                canEdit={canEditDrive}
                documents={drive.documents.map((d) => ({
                  id: d.id,
                  label: d.label,
                  originalName: d.file.originalName,
                  sizeBytes: d.file.sizeBytes,
                  createdAt: d.createdAt.toISOString(),
                  dataUrl: d.file.dataUrl,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-4">
          <CommunicationsPanel conversations={conversations} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <NotesPanel
                driveId={drive.id}
                canEdit={canEditDrive}
                notes={drive.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: { name: n.author.name } }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <HistoryTrailPanel
                entries={drive.historyEntries.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt.toISOString(), actor: { name: e.actor.name } }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
