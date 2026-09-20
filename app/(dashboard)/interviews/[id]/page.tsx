import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { InterviewDetailActions } from "@/components/interviews/interview-detail-actions";
import { InterviewInfoCard } from "@/components/interviews/interview-info-card";
import { InterviewRoomBanner } from "@/components/interviews/interview-room-banner";
import { InterviewStudentSnapshot } from "@/components/interviews/interview-student-snapshot";
import { InterviewEvaluationPanel } from "@/components/interviews/interview-evaluation-panel";
import { InterviewPanelCard } from "@/components/interviews/interview-panel-card";
import { ApplicationTimeline } from "@/components/applications/application-timeline";
import { ApplicationInterviewsTab } from "@/components/applications/application-interviews-tab";

export default async function InterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // interview.view isn't held by Student (see lib/rbac/permissions.ts), so
  // unlike Applications/Offers/Students there's no self-service overlap to
  // guard against here — the permission gate alone is sufficient.
  const canView = await hasPermission(session, "interview.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this interview.</CardContent>
      </Card>
    );
  }

  const candidate = await db.roundCandidate.findUnique({
    where: { id },
    include: {
      round: { include: { drive: { include: { company: true } } } },
      student: { include: { user: true, course: true, skills: { include: { skill: true } } } },
      application: {
        include: {
          statusHistory: { orderBy: { createdAt: "asc" } },
          roundCandidacies: { include: { round: true }, orderBy: { assignedAt: "asc" } },
          resume: { include: { file: true } },
        },
      },
      panelMembers: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!candidate) notFound();

  const scorecardTemplate = await db.scorecardTemplate.findUnique({ where: { collegeId_roundType: { collegeId: session.collegeId, roundType: candidate.round.roundType } } });
  const criteriaLabels: Record<string, string> = {};
  if (scorecardTemplate) {
    for (const c of scorecardTemplate.criteria as { key: string; label: string }[]) criteriaLabels[c.key] = c.label;
  }

  const changedByIds = [...new Set(candidate.application.statusHistory.map((h) => h.changedById))];
  const changedByUsers = changedByIds.length > 0 ? await db.user.findMany({ where: { id: { in: changedByIds } }, select: { id: true, name: true } }) : [];
  const changedByName = new Map(changedByUsers.map((u: { id: string; name: string }) => [u.id, u.name]));

  const canManage = await hasPermission(session, "interview.schedule");
  const canScore = await hasPermission(session, "round.score");

  // Automatic next-round suggestion (spec section 20): after a PASSED
  // result, look at the drive's real SelectionRound sequence and offer the
  // next one this application isn't already assigned to — no invented
  // round, just the actual next sequenceNo.
  let nextRound: { applicationId: string; roundId: string; roundName: string } | null = null;
  if (candidate.status === "PASSED") {
    const allRounds = await db.selectionRound.findMany({ where: { driveId: candidate.round.driveId }, orderBy: { sequenceNo: "asc" } });
    const currentIndex = allRounds.findIndex((r: { id: string }) => r.id === candidate.roundId);
    const assignedRoundIds = new Set(candidate.application.roundCandidacies.map((rc) => rc.roundId));
    const next = allRounds.slice(currentIndex + 1).find((r: { id: string }) => !assignedRoundIds.has(r.id));
    if (next) nextRound = { applicationId: candidate.applicationId, roundId: next.id, roundName: next.name };
  }

  const rounds = candidate.application.roundCandidacies.map((r) => ({
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
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/interviews" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to interviews
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{candidate.round.name}</h1>
            <StatusBadge status={candidate.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {candidate.round.drive.title} · {candidate.round.drive.company.name} · Round {candidate.round.sequenceNo}
          </p>
          <p className="text-muted-foreground text-sm">{candidate.student.user.name}</p>
        </div>
        <InterviewDetailActions
          candidate={{
            id: candidate.id,
            status: candidate.status,
            scheduledAt: candidate.scheduledAt?.toISOString() ?? null,
            mode: candidate.mode,
            venue: candidate.venue,
            meetingUrl: candidate.meetingUrl,
            interviewerName: candidate.interviewerName,
            interviewerId: candidate.interviewerId,
          }}
          recipientUserId={candidate.student.userId}
          canManage={canManage}
          nextRound={nextRound}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {candidate.status === "IN_PROGRESS" && candidate.startedAt && (
            <InterviewRoomBanner startedAt={candidate.startedAt.toISOString()} />
          )}

          <InterviewInfoCard
            info={{
              companyName: candidate.round.drive.company.name,
              driveTitle: candidate.round.drive.title,
              roundName: candidate.round.name,
              roundType: candidate.round.roundType,
              scheduledAt: candidate.scheduledAt?.toISOString() ?? null,
              mode: candidate.mode,
              venue: candidate.venue,
              meetingUrl: candidate.meetingUrl,
              interviewerName: candidate.interviewerName,
            }}
          />

          <InterviewEvaluationPanel
            candidateId={candidate.id}
            roundType={candidate.round.roundType}
            canEvaluate={canScore}
            criteriaLabels={criteriaLabels}
            evaluation={{
              status: candidate.status,
              score: candidate.score,
              strengths: candidate.strengths,
              weaknesses: candidate.weaknesses,
              feedback: candidate.feedback,
              recommendation: candidate.recommendation,
              criteriaScores: candidate.criteriaScores as Record<string, number> | null,
            }}
          />

          <InterviewPanelCard
            candidateId={candidate.id}
            canManage={canManage}
            canScore={canScore}
            members={candidate.panelMembers.map((m) => ({ id: m.id, name: m.name, role: m.role, score: m.score, feedback: m.feedback }))}
          />

          {candidate.status === "NO_SHOW" && candidate.noShowReason && (
            <Card>
              <CardContent className="text-sm pt-6">
                <div className="text-muted-foreground text-xs">No-show reason</div>
                <p>{candidate.noShowReason}</p>
              </CardContent>
            </Card>
          )}
          {candidate.status === "CANCELLED" && candidate.cancelReason && (
            <Card>
              <CardContent className="text-sm pt-6">
                <div className="text-muted-foreground text-xs">Cancellation reason</div>
                <p>{candidate.cancelReason}</p>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="mb-2 text-sm font-medium">All rounds for this application</h2>
            <ApplicationInterviewsTab rounds={rounds} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium">Application timeline</h2>
            <ApplicationTimeline
              entries={candidate.application.statusHistory.map((h) => ({
                id: h.id,
                fromStatus: h.fromStatus,
                toStatus: h.toStatus,
                reason: h.reason,
                actorName: changedByName.get(h.changedById) ?? "System",
                createdAt: h.createdAt.toISOString(),
              }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <InterviewStudentSnapshot
            student={{
              id: candidate.studentId,
              name: candidate.student.user.name,
              enrollmentNumber: candidate.student.enrollmentNumber,
              courseLabel: candidate.student.course.specialization ?? candidate.student.course.name,
              aggregate: candidate.student.aggregate,
              aggregateType: candidate.student.aggregateType,
              tenthScore: candidate.student.tenthScore,
              twelfthScore: candidate.student.twelfthScore,
              liveBacklogs: candidate.student.liveBacklogs,
              skills: candidate.student.skills.map((s) => s.skill.name),
              resumeName: candidate.application.resume?.name ?? null,
              resumeUrl: candidate.application.resume?.file?.dataUrl ?? null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
