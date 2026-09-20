import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagsEditor } from "@/components/students/tags-editor";
import { computeReadinessScore, computeRiskSignals } from "@/lib/students/insights";

export async function OverviewTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [student, canEdit, resumeCount, skillCount, applicationCount, interviewCount, acceptedOffer, latestApplication, latestResume] = await Promise.all([
    db.student.findUniqueOrThrow({ where: { id: studentId } }),
    hasPermission(session, "student.edit"),
    db.resume.count({ where: { studentId } }),
    db.studentSkill.count({ where: { studentId } }),
    db.application.count({ where: { studentId } }),
    db.roundCandidate.count({ where: { studentId } }),
    db.offer.findFirst({
      where: { studentId, status: { in: ["ACCEPTED", "JOINING_PENDING", "JOINED"] } },
      include: { drive: { include: { company: true } }, position: true },
    }),
    db.application.findFirst({ where: { studentId }, orderBy: { appliedAt: "desc" }, select: { appliedAt: true } }),
    db.resume.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const shortlistedCount = await db.application.count({
    where: { studentId, status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED"] } },
  });
  const offerCount = await db.offer.count({ where: { studentId } });

  const { score, breakdown } = computeReadinessScore({
    aggregate: student.aggregate,
    liveBacklogs: student.liveBacklogs,
    resumeCount,
    skillCount,
    applicationCount,
    interviewCount,
  });

  const lastActivityCandidates = [student.updatedAt, latestApplication?.appliedAt, latestResume?.createdAt].filter(Boolean) as Date[];
  const lastActivityAt = lastActivityCandidates.length > 0 ? new Date(Math.max(...lastActivityCandidates.map((d) => d.getTime()))) : null;

  const riskSignals = computeRiskSignals({
    eligibleForPlacements: student.eligibleForPlacements,
    placementStatus: student.placementStatus,
    applicationCount,
    liveBacklogs: student.liveBacklogs,
    resumeCount,
    lastActivityAt,
    aggregate: student.aggregate,
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
        <CardContent>
          <TagsEditor studentId={studentId} tags={student.tags} canEdit={canEdit} />
        </CardContent>
      </Card>

      {riskSignals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Needs Attention</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {riskSignals.map((s, i) => (
              <Badge
                key={i}
                className={
                  s.severity === "warning"
                    ? "border-none bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                    : "border-none bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
                }
              >
                ⚠️ {s.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Placement Status</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {acceptedOffer ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-muted-foreground">Status: <span className="text-foreground font-medium">Placed</span></div>
                <div className="text-muted-foreground">Company: <span className="text-foreground font-medium">{acceptedOffer.drive.company.name}</span></div>
                {acceptedOffer.position && <div className="text-muted-foreground">Role: <span className="text-foreground font-medium">{acceptedOffer.position.title}</span></div>}
                <div className="text-muted-foreground">Package: <span className="text-foreground font-medium">₹{Number(acceptedOffer.totalCompensation).toLocaleString("en-IN")}</span></div>
                {acceptedOffer.joiningDate && (
                  <div className="text-muted-foreground">Joining: <span className="text-foreground font-medium">{acceptedOffer.joiningDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span></div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground">Status: <span className="text-foreground font-medium">{student.eligibleForPlacements ? "Seeking" : "Not seeking"}</span></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Academic Snapshot</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="CGPA" value={student.aggregate ?? "—"} />
            <Stat label="Active Backlogs" value={student.liveBacklogs} />
            <Stat label="Applications" value={applicationCount} />
            <Stat label="Offers" value={offerCount} />
            <Stat label="Interview Rounds" value={interviewCount} />
            <Stat label="Shortlisted" value={shortlistedCount} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Placement Readiness</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="text-2xl font-semibold tabular-nums">{score} / 100</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <ReadinessItem label="Academic" value={breakdown.academic} />
            <ReadinessItem label="Resume" value={breakdown.resume} />
            <ReadinessItem label="Skills" value={breakdown.skills} />
            <ReadinessItem label="Applications" value={breakdown.applications} />
            <ReadinessItem label="Interview Readiness" value={breakdown.interviewReadiness} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ReadinessItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-[11px]">{label}</div>
    </div>
  );
}
