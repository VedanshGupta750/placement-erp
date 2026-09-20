import Link from "next/link";
import { AlertTriangle, TrendingUp, TrendingDown, Building2, Lightbulb } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCollegeAnalytics } from "@/lib/analytics/stats";
import { getAttentionStudents } from "@/lib/dashboard/get-attention-students";
import { getActionItems } from "@/lib/dashboard/get-action-items";
import { getSkillGaps, getActivelyHiringCompanies } from "@/lib/insights/skill-gap";

// "AI-powered insights" per the spec, built honestly: every card here is a
// real, explainable rule against live data (see lib/insights/skill-gap.ts
// and the reused dashboard signals below) — not an LLM call, so there's
// nothing to hallucinate and nothing that needs a disclaimer about being
// occasionally wrong in a way nobody can audit.
export default async function InsightsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "report.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to insights.</CardContent>
      </Card>
    );
  }

  const activeBatchId = await getActiveBatchId();
  const [analytics, attentionStudents, actionItems, skillGaps, hiringCompanies] = await Promise.all([
    getCollegeAnalytics(db, activeBatchId),
    getAttentionStudents(db, session.collegeId, 8, activeBatchId),
    getActionItems(db, session.collegeId, activeBatchId),
    getSkillGaps(db, 6, activeBatchId),
    getActivelyHiringCompanies(db, 6, activeBatchId),
  ]);

  const bestDept = analytics.departmentRows[0];
  const worstDept = [...analytics.departmentRows].reverse()[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Placement Insights</h1>
        <p className="text-muted-foreground text-sm">Rule-based signals from live data — every card here is explainable, not an AI guess.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {bestDept && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0"><TrendingUp className="text-emerald-500 size-4" /><CardTitle className="text-base">Best-performing department</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{bestDept.name}</div>
              <p className="text-muted-foreground text-sm">{bestDept.pct.toFixed(1)}% placed ({bestDept.placed} of {bestDept.total})</p>
            </CardContent>
          </Card>
        )}
        {worstDept && worstDept.name !== bestDept?.name && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0"><TrendingDown className="text-amber-500 size-4" /><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{worstDept.name}</div>
              <p className="text-muted-foreground text-sm">{worstDept.pct.toFixed(1)}% placed ({worstDept.placed} of {worstDept.total}) — lowest among departments</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0"><AlertTriangle className="text-amber-500 size-4" /><CardTitle className="text-base">Students who need attention ({attentionStudents.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {attentionStudents.map((s) => (
            <Link key={s.id} href={s.href} className="hover:bg-accent/40 flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-muted-foreground text-xs">{s.courseLabel} · {s.appliedCount} applied of {s.eligibleDrivesCount} eligible drives</div>
              </div>
              <Badge variant="outline">{s.flag}</Badge>
            </Link>
          ))}
          {attentionStudents.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No students currently flagged.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0"><Lightbulb className="text-primary size-4" /><CardTitle className="text-base">Recommended actions</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {actionItems.map((item) => (
            <Link key={item.id} href={item.href} className="hover:bg-accent/40 flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-muted-foreground text-xs">{item.subtitle}</div>
              </div>
            </Link>
          ))}
          {actionItems.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">Nothing needs attention right now.</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Skill gaps</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-muted-foreground mb-1 text-xs">Skills required by active drives that under 30% of students have.</p>
            {skillGaps.map((g: { skillId: string; name: string; drivesRequiring: number; studentsWithSkill: number; coveragePct: number }) => (
              <div key={g.skillId} className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground">{g.drivesRequiring} drive{g.drivesRequiring === 1 ? "" : "s"} need it · {g.coveragePct}% of students have it</span>
              </div>
            ))}
            {skillGaps.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No significant skill gaps right now.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0"><Building2 className="size-4" /><CardTitle className="text-base">Actively hiring</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {hiringCompanies.map((c: { id: string; name: string; activeDrives: number; totalApplicants: number }) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="hover:bg-accent/40 flex items-center justify-between rounded px-1 py-1.5 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{c.activeDrives} active drive{c.activeDrives === 1 ? "" : "s"} · {c.totalApplicants} applicants</span>
              </Link>
            ))}
            {hiringCompanies.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No companies currently hiring.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
