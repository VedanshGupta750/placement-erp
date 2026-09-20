import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkStudentEligibility } from "@/lib/students/eligibility-check";

// Reuses the exact same eligibility engine already proven for Drives
// (lib/eligibility.ts) run in reverse — one student against every currently
// active drive with a published rule — so the explanation reads identically
// to the Drive side's own eligibility breakdown.
export async function EligibilityTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const results = await checkStudentEligibility(db, studentId);
  const eligibleCount = results.filter((r) => r.eligible).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="text-sm font-medium">
          Eligible for {eligibleCount} / {results.length} active drive{results.length === 1 ? "" : "s"}
        </p>

        {results.length === 0 && (
          <p className="text-muted-foreground text-sm">No active drives with a published eligibility rule right now.</p>
        )}

        <div className="flex flex-col divide-y">
          {results.map((r) => (
            <div key={r.driveId} className="flex flex-col gap-1 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{r.companyName}</div>
                  <div className="text-muted-foreground text-xs">{r.driveTitle}</div>
                </div>
                <Badge
                  className={
                    r.eligible
                      ? "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                  }
                >
                  {r.eligible ? "✅ Eligible" : "❌ Not eligible"}
                </Badge>
              </div>
              {/* An override decides the badge above, so say so — otherwise
                  a student forced in past a failed rule sees "Eligible"
                  sitting directly above the reason they failed it. */}
              {r.overrideReason && (
                <p className="ml-1 text-xs text-amber-700 dark:text-amber-400">
                  Set manually by the placement cell — {r.overrideReason}
                </p>
              )}
              {!r.eligible && r.reasons.length > 0 && (
                <ul className="text-muted-foreground ml-1 list-disc pl-4 text-xs">
                  {r.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
