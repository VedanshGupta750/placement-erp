import { TrendingUp, Target, Users, Info } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPipelineForecast, getDepartmentForecast } from "@/lib/forecasts/pipeline-forecast";

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
  const forecast = await getPipelineForecast(db, activeBatchId);
  const deptForecast = await getDepartmentForecast(db, forecast.selectRatePct / 100, forecast.confident, activeBatchId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forecasts</h1>
        <p className="text-muted-foreground text-sm">A pipeline-conversion projection using this season&apos;s real conversion rates — not a black-box prediction.</p>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10">
        <CardContent className="flex items-start gap-3 pt-6 text-sm">
          <Info className="text-blue-600 dark:text-blue-400 mt-0.5 size-4 shrink-0" />
          <p>
            This projects outcomes for the <strong>{forecast.inProgressCount}</strong> applications currently in progress by applying this season&apos;s
            observed conversion rates (select rate {forecast.selectRatePct}%, interview pass rate {forecast.interviewPassRatePct}%) — computed from{" "}
            {forecast.sampleSize} applications and {forecast.interviewSampleSize} interview outcomes that have already resolved. It is not a time-series
            prediction: this season&apos;s data doesn&apos;t have enough spread across dates yet for that to be meaningful.
          </p>
        </CardContent>
      </Card>

      {!forecast.confident ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Not enough resolved applications or interview outcomes yet ({forecast.sampleSize} applications, {forecast.interviewSampleSize} interview
            results) to project a reliable conversion rate. This fills in as more of this season&apos;s pipeline resolves.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Target} label="Current placement %" value={`${forecast.currentPlacementPct}%`} sublabel={`${forecast.currentPlacedCount} of ${forecast.eligibleStudentCount}`} color="blue" />
            <StatCard icon={TrendingUp} label="Projected placement %" value={`${forecast.projectedPlacementPct}%`} sublabel={`+${forecast.expectedAdditionalPlacements} expected`} color="emerald" />
            <StatCard icon={Users} label="In progress" value={forecast.inProgressCount} sublabel="Applications not yet resolved" color="amber" />
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
