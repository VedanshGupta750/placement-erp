import Link from "next/link";
import { ClipboardCheck, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Real per-applicant assessment performance for this drive, sourced from
// StudentSkillProfile (synced from the fully separate
// ~/placement-erp-assessments app — see scripts/sync-student-skill-profiles.ts).
// This is NOT a live cross-service query: the profile is only as fresh as
// the last sync run, and that's stated plainly rather than implied to be
// real-time. A student who hasn't taken a real assessment yet has no
// profile row at all — shown honestly as "no assessment data", never a
// fabricated 0%.
export async function AssessmentsPanel({ driveId }: { driveId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const applications = await db.application.findMany({
    where: { driveId },
    select: {
      id: true,
      studentId: true,
      student: {
        select: {
          enrollmentNumber: true,
          user: { select: { name: true } },
          skillProfile: {
            select: { finalizedAttemptCount: true, avgScorePercent: true, codingSubmissionCount: true, avgCodingPassPercent: true, syncedAt: true },
          },
        },
      },
    },
  });

  const withProfile = applications.filter(
    (a: { student: { skillProfile: { finalizedAttemptCount: number } | null } }) =>
      a.student.skillProfile && a.student.skillProfile.finalizedAttemptCount > 0
  );
  const ranked = [...withProfile].sort(
    (
      a: { student: { skillProfile: { avgScorePercent: number | null } | null } },
      b: { student: { skillProfile: { avgScorePercent: number | null } | null } }
    ) => (b.student.skillProfile?.avgScorePercent ?? 0) - (a.student.skillProfile?.avgScorePercent ?? 0)
  );
  const latestSync = ranked.length > 0 ? ranked[0].student.skillProfile?.syncedAt ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Applicants ranked by real assessment performance
          </CardTitle>
          <CardDescription>
            {ranked.length} of {applications.length} applicant{applications.length === 1 ? "" : "s"} have taken at
            least one real assessment on this college&apos;s assessment platform.
            {latestSync && ` Synced ${new Date(latestSync).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} — not live.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No applicant for this drive has a finalized assessment attempt yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {ranked.map(
                (a: {
                  id: string;
                  studentId: string;
                  student: {
                    enrollmentNumber: string;
                    user: { name: string };
                    skillProfile: {
                      finalizedAttemptCount: number;
                      avgScorePercent: number | null;
                      codingSubmissionCount: number;
                      avgCodingPassPercent: number | null;
                    } | null;
                  };
                }) => {
                  const p = a.student.skillProfile!;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div>
                        <Link href={`/students/${a.studentId}`} className="font-medium hover:underline">
                          {a.student.user.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">
                          {a.student.enrollmentNumber} · {p.finalizedAttemptCount} assessment{p.finalizedAttemptCount === 1 ? "" : "s"} taken
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.avgScorePercent != null && (
                          <Badge variant={p.avgScorePercent >= 70 ? "default" : "outline"} className={p.avgScorePercent >= 70 ? "bg-emerald-600" : ""}>
                            {Math.round(p.avgScorePercent)}% avg score
                          </Badge>
                        )}
                        {p.avgCodingPassPercent != null && (
                          <Badge variant="outline">{Math.round(p.avgCodingPassPercent)}% coding tests passed</Badge>
                        )}
                        {p.finalizedAttemptCount < 3 && (
                          <span className="text-muted-foreground text-xs">(early signal — {p.finalizedAttemptCount} attempt{p.finalizedAttemptCount === 1 ? "" : "s"})</span>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <ClipboardCheck className="text-muted-foreground size-6" />
          <p className="text-muted-foreground max-w-md text-xs">
            This is a periodic sync, not a live view — full test/proctoring detail still lives in the assessment
            platform itself.
          </p>
          <Button variant="outline" size="sm" render={<a href="/api/assessments/sso" target="_blank" rel="noopener" />}>
            Open Assessments
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
