import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ApplicationHeaderActions } from "@/components/applications/application-header-actions";
import { ApplicationTimeline } from "@/components/applications/application-timeline";
import { ApplicationEligibilityTab } from "@/components/applications/application-eligibility-tab";
import { ApplicationInterviewsTab } from "@/components/applications/application-interviews-tab";
import { ApplicationOfferTab } from "@/components/applications/application-offer-tab";
import { ApplicationNotesTab } from "@/components/applications/application-notes-tab";

const PRIORITY_CLASSES: Record<string, string> = {
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  URGENT: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "application.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this application.</CardContent>
      </Card>
    );
  }

  // application.view is a permission every Student also holds (for their
  // OWN applications list) — without this check, that same permission let
  // a student open any OTHER student's Application 360 page just by
  // guessing/enumerating an id, exposing skill match, eligibility
  // snapshot, interview feedback, and internal notes. Same vulnerability
  // class as the one fixed in the Students module earlier this session:
  // a permission shared between self-service and staff surfaces needs an
  // explicit ownership check, not just the permission grant.
  const caller = await db.user.findUnique({ where: { id: session.userId }, select: { userType: true } });
  if (caller?.userType === "STUDENT") {
    const ownStudent = await db.student.findUnique({ where: { userId: session.userId }, select: { id: true } });
    const owns = ownStudent ? await db.application.findFirst({ where: { id, studentId: ownStudent.id }, select: { id: true } }) : null;
    if (!owns) {
      return (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this application.</CardContent>
        </Card>
      );
    }
  }

  const application = await db.application.findUnique({
    where: { id },
    include: {
      student: { include: { user: true, course: true, department: true, skills: { include: { skill: true } } } },
      drive: { include: { company: true, requiredSkills: { include: { skill: true } } } },
      position: true,
      resume: { include: { file: true } },
      eligibilityResult: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      offer: true,
      roundCandidacies: { include: { round: true }, orderBy: { assignedAt: "asc" } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      owner: { select: { name: true } },
    },
  });
  if (!application) notFound();

  const changedByIds = [...new Set(application.statusHistory.map((h) => h.changedById))];
  const changedByUsers = changedByIds.length > 0 ? await db.user.findMany({ where: { id: { in: changedByIds } }, select: { id: true, name: true } }) : [];
  const changedByName = new Map(changedByUsers.map((u: { id: string; name: string }) => [u.id, u.name]));

  const [canMoveStage, canAddNote] = await Promise.all([
    hasPermission(session, "application.approve"),
    hasPermission(session, "application.approve"),
  ]);

  const explanation = application.eligibilityResult?.explanation as { field: string; operator: string; expected: unknown; actual: unknown; passed: boolean }[] | undefined;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/applications" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to applications
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{application.student.user.name}</h1>
            <StatusBadge status={application.status} />
            {application.priority !== "NORMAL" && (
              <Badge className={`border-none ${PRIORITY_CLASSES[application.priority] ?? ""}`}>{application.priority}</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {application.position.title} · {application.drive.company.name}
          </p>
          <p className="text-muted-foreground font-mono text-xs">APP-{application.id.slice(-8).toUpperCase()}</p>
        </div>
        <ApplicationHeaderActions
          applicationId={application.id}
          status={application.status}
          recipientUserId={application.student.userId}
          canMoveStage={canMoveStage}
          initialPriority={application.priority}
          initialOwnerName={application.owner?.name ?? null}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="interviews">Interviews ({application.roundCandidacies.length})</TabsTrigger>
          <TabsTrigger value="offer">Offer</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes ({application.notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Application</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Student</div><Link href={`/students/${application.studentId}`} className="text-primary hover:underline">{application.student.user.name}</Link></div>
                <div><div className="text-muted-foreground text-xs">Enrollment</div><div className="font-mono">{application.student.enrollmentNumber}</div></div>
                <div><div className="text-muted-foreground text-xs">Drive</div><Link href={`/drives/${application.driveId}`} className="text-primary hover:underline">{application.drive.title}</Link></div>
                <div><div className="text-muted-foreground text-xs">Position</div><div>{application.position.title}</div></div>
                <div><div className="text-muted-foreground text-xs">Applied</div><div>{application.appliedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</div></div>
                <div><div className="text-muted-foreground text-xs">Current stage</div><div><StatusBadge status={application.status} /></div></div>
                <div><div className="text-muted-foreground text-xs">Owner</div><div>{application.owner?.name ?? "Unassigned"}</div></div>
                <div><div className="text-muted-foreground text-xs">Course</div><div>{application.student.course.specialization ?? application.student.course.name}</div></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Skill Match</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{application.matchScore ?? "—"}</span>
                  {application.matchScore != null && <span className="text-muted-foreground text-sm">%</span>}
                </div>
                <p className="text-muted-foreground text-xs">Real skill-overlap between the student&apos;s profile and this drive&apos;s required skills — not an AI score.</p>
                {application.matchedSkills.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">Matched</div>
                    <div className="flex flex-wrap gap-1.5">{application.matchedSkills.map((s) => <Badge key={s} variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">{s}</Badge>)}</div>
                  </div>
                )}
                {application.missingSkills.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">Missing</div>
                    <div className="flex flex-wrap gap-1.5">{application.missingSkills.map((s) => <Badge key={s} variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-400">{s}</Badge>)}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ApplicationTimeline
            entries={application.statusHistory.map((h) => ({
              id: h.id,
              fromStatus: h.fromStatus,
              toStatus: h.toStatus,
              reason: h.reason,
              actorName: changedByName.get(h.changedById) ?? "System",
              createdAt: h.createdAt.toISOString(),
            }))}
          />
        </TabsContent>

        <TabsContent value="eligibility" className="mt-4">
          <ApplicationEligibilityTab eligible={application.eligibilityResult?.eligible ?? null} checks={explanation ?? null} />
        </TabsContent>

        <TabsContent value="interviews" className="mt-4">
          <ApplicationInterviewsTab
            rounds={application.roundCandidacies.map((r) => ({
              id: r.id,
              roundName: r.round.name,
              roundType: r.round.roundType,
              status: r.status,
              mode: r.mode,
              scheduledAt: r.scheduledAt?.toISOString() ?? null,
              venue: r.venue,
              meetingUrl: r.meetingUrl,
              interviewerName: r.interviewerName,
              score: r.score,
              feedback: r.feedback,
            }))}
          />
        </TabsContent>

        <TabsContent value="offer" className="mt-4">
          <ApplicationOfferTab
            offer={
              application.offer
                ? {
                    id: application.offer.id,
                    status: application.offer.status,
                    totalCompensation: application.offer.totalCompensation.toString(),
                    offerDate: application.offer.offerDate?.toISOString() ?? null,
                    joiningDate: application.offer.joiningDate?.toISOString() ?? null,
                  }
                : null
            }
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Resume used</CardTitle></CardHeader>
            <CardContent>
              {application.resume ? (
                <div className="text-sm">
                  {application.resume.file?.dataUrl ? (
                    <a href={application.resume.file.dataUrl} download={application.resume.file.originalName} className="font-medium hover:underline">
                      {application.resume.name}
                    </a>
                  ) : (
                    <div className="font-medium">{application.resume.name}</div>
                  )}
                  <div className="text-muted-foreground text-xs">
                    Snapshot at the time of application — later resume edits don&apos;t change this.
                    {!application.resume.file?.dataUrl && " This resume was uploaded before file download was wired up, so it isn't downloadable."}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No resume was attached to this application.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <ApplicationNotesTab
            applicationId={application.id}
            canAdd={canAddNote}
            notes={application.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), authorName: n.author.name }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
