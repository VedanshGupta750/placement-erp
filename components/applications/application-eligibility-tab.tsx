import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Check = { field: string; operator: string; expected: unknown; actual: unknown; passed: boolean };

const FIELD_LABELS: Record<string, string> = {
  cgpa: "CGPA",
  active_backlogs: "Active backlogs",
  batch_year: "Batch year",
  course_id: "Course",
  department_id: "Department",
  tenth_score: "10th %",
  twelfth_score: "12th %",
  diploma_score: "Diploma %",
  closed_backlogs: "Historical backlogs",
  skill_ids: "Required skills",
  has_experience: "Work experience on file",
  has_certification: "Certification on file",
};

// Renders the frozen EligibilityResult.explanation captured at the moment
// this application was created — deliberately NOT a live re-evaluation, per
// the schema's own design note: a student's CGPA/backlogs changing later
// must never retroactively change what this application's eligibility
// said at the time.
export function ApplicationEligibilityTab({ eligible, checks }: { eligible: boolean | null; checks: Check[] | null }) {
  if (eligible === null || !checks) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          No eligibility snapshot was recorded for this application (it may predate the drive&apos;s eligibility rule, or was added as a manual override).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Eligibility Snapshot</CardTitle>
        <Badge className={`border-none ${eligible ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"}`}>
          {eligible ? "Eligible" : "Not Eligible"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-2">
              {c.passed ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-rose-600" />}
              <span>{FIELD_LABELS[c.field] ?? c.field} {c.operator} {Array.isArray(c.expected) ? c.expected.join(", ") : String(c.expected)}</span>
            </div>
            <span className="text-muted-foreground tabular-nums">{Array.isArray(c.actual) ? c.actual.length : String(c.actual ?? "n/a")}</span>
          </div>
        ))}
      </CardContent>
      <CardContent className="pt-0">
        <p className="text-muted-foreground text-xs">This eligibility snapshot is preserved as-is — a student&apos;s CGPA or backlogs changing later never retroactively alters this record.</p>
      </CardContent>
    </Card>
  );
}
