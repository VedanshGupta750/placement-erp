import { TrendingUp, Target, Users, Info, TriangleAlert } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPipelineForecast, getDepartmentForecast } from "@/lib/forecasts/pipeline-forecast";
import { readEligibilityPolicy, eligibleStudentWhere } from "@/lib/students/eligibility-policy";

export default async function ForecastsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "report.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to forecasts.</CardContent>
      </Card>
    );
  }

  const activeBatchId = await getActiveBatchId();

  // The denominator has to mean the same thing as the Students page's
  // "Eligible" count, or the two pages quote different placement percentages
  // for the same batch.
  const policy = readEligibilityPolicy(
    await prisma.college.findUniqueOrThrow({
      where: { id: session.collegeId },
      select: {
        eligibilityPolicyEnabled: true,
        eligibilityMinCgpa: true,
        eligibilityMaxLiveBacklogs: true,
        eligibilityMinTenthScore: true,
        eligibilityMinTwelfthScore: true,
        eligibilityRequireAcademics: true,
      },
    }),
  );

  const forecast = await getPipelineForecast(db, activeBatchId, eligibleStudentWhere(policy));
  // The raw rate, not the rounded percentage — so the departments sum to
  // roughly the college-wide figure instead of drifting by a student.
  const deptForecast = await getDepartmentForecast(db, {
    rate: forecast.conversionRate,
    basis: forecast.basis,
    confident: forecast.confident,
    batchId: activeBatchId,
  });

  const studentBasis = forecast.basis === "student";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forecasts</h1>
        <p className="text-muted-foreground text-sm">A pipeline-conversion projection using this season&apos;s real conversion rates — not a black-box prediction.</p>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10">
        <CardContent className="flex items-start gap-3 pt-6 text-sm">
          <Info className="text-blue-600 dark:text-blue-400 mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-2">
            <p>
              This projects outcomes for the <strong>{forecast.inProgressStudents}</strong> student
              {forecast.inProgressStudents === 1 ? "" : "s"} who still have applications running (
              {forecast.inProgressApplications} application{forecast.inProgressApplications === 1 ? "" : "s"} between
              them), using a conversion rate of <strong>{forecast.conversionRatePct}%</strong> measured from{" "}
              {forecast.sampleSize} {forecast.sampleUnit} that have already finished.
            </p>
            <p>
              {studentBasis ? (
                <>
                  That rate is the share of students whose season is over who ended up placed — a per-student figure,
                  so it applies directly to the student count above.
                </>
              ) : (
                <>
                  Too few students have finished their season to measure a per-student rate yet, so this falls back to
                  the per-application select rate and converts it per student: someone with several live applications
                  has more than one chance. That conversion treats their applications as independent, which overstates
                  things slightly for very strong and very weak candidates.
                </>
              )}{" "}
              The interview pass rate ({forecast.interviewPassRatePct}% over {forecast.interviewSampleSize} outcomes)
              is shown for context and is <strong>not</strong> compounded into the projection — the conversion rate
              above already covers the whole funnel, interviews included.
            </p>
          </div>
        </CardContent>
      </Card>

      {!forecast.confident ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Not enough finished work to project from yet — {forecast.settledStudentCount} student
            {forecast.settledStudentCount === 1 ? " has" : "s have"} completed their season and{" "}
            {forecast.resolvedApplicationCount} application{forecast.resolvedApplicationCount === 1 ? " has" : "s have"}{" "}
            resolved. This fills in as more of this season&apos;s pipeline closes out.
          </CardContent>
        </Card>
      ) : (
        <>
          {forecast.indicative && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
              <CardContent className="flex items-start gap-3 pt-6 text-sm text-amber-900 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p>
                  Treat this as indicative only. The rate rests on {forecast.sampleSize} {forecast.sampleUnit}, so a
                  handful of further results can move the projection substantially. It settles as more of the season
                  resolves.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Target} label="Current placement %" value={`${forecast.currentPlacementPct}%`} sublabel={`${forecast.currentPlacedCount} of ${forecast.eligibleStudentCount} eligible`} color="blue" />
            <StatCard icon={TrendingUp} label="Projected placement %" value={`${forecast.projectedPlacementPct}%`} sublabel={`+${forecast.expectedAdditionalPlacements} expected`} color="emerald" />
            <StatCard icon={Users} label="In progress" value={forecast.inProgressStudents} sublabel="Students with live applications" color="amber" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">By department</CardTitle></CardHeader>
            <CardContent className="flex flex-col divide-y">
              {deptForecast.map((d: { name: string; inProgressCount: number; expectedAdditional: number }) => (
                <div key={d.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">{d.inProgressCount} in progress · +{d.expectedAdditional} expected</span>
                </div>
              ))}
              {deptForecast.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No applications in progress right now.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
