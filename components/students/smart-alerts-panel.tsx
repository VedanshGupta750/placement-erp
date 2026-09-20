import Link from "next/link";
import { Bell } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Kept as a plain (non-component) helper — calling `new Date()` directly
// inside a component body trips the "impure function during render" rule.
function joiningWindow() {
  const now = new Date();
  return { gte: now, lte: new Date(now.getTime() + 14 * 86400000) };
}

// Computed live on every render, never persisted (same no-stale-state rule
// as lib/events/status.ts and lib/students/insights.ts — no background job
// runner in this app). Each alert links straight into the pre-filtered list
// so a TPO can act on it immediately.
export async function SmartAlertsPanel({ batchId = null }: { batchId?: string | null }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const batchWhere = batchId ? { batchId } : {};

  const [noDocuments, joiningSoon, seekingNoApplications] = await Promise.all([
    db.student.count({
      where: { eligibleForPlacements: true, placementStatus: { not: "PLACED" }, documents: { none: {} }, ...batchWhere },
    }),
    db.offer.count({
      where: {
        status: { in: ["ACCEPTED", "JOINING_PENDING"] },
        joiningDate: joiningWindow(),
        ...(batchId ? { student: { batchId } } : {}),
      },
    }),
    db.student.count({
      where: { eligibleForPlacements: true, placementStatus: "SEEKING", applications: { none: {} }, ...batchWhere },
    }),
  ]);

  const alerts = [
    seekingNoApplications > 0 && {
      text: `${seekingNoApplications} eligible student${seekingNoApplications === 1 ? "" : "s"} haven't applied to anything yet`,
      href: "/students?eligible=1",
    },
    joiningSoon > 0 && {
      text: `${joiningSoon} offer${joiningSoon === 1 ? "" : "s"} have joining dates in the next 2 weeks`,
      href: "/offers",
    },
    noDocuments > 0 && {
      text: `${noDocuments} eligible student${noDocuments === 1 ? "" : "s"} have no documents on file`,
      href: "/students?eligible=1",
    },
  ].filter(Boolean) as { text: string; href: string }[];

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Smart Alerts</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {alerts.map((a, i) => (
          <Link key={i} href={a.href} className="hover:bg-accent/50 flex items-start gap-2 rounded-md p-1.5 text-sm transition-colors">
            <Bell className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <span>{a.text}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
