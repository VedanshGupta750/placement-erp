import Link from "next/link";
import { CheckCircle2, ShieldAlert, Users, XCircle } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLACED_OFFER_STATUSES } from "@/lib/students/placement";

// Company-level eligibility, deliberately grouped BY DRIVE rather than
// rolled into one company-wide number. Eligibility is defined per drive —
// a company running two drives with different CGPA cut-offs has two
// different eligible populations, and a single "eligible for Infosys"
// figure would be a fiction. This answers "where does this company stand
// across everything it is running with us" without inventing that number.
export async function CompanyEligibilityTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const drives = await db.drive.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      registrationClosesAt: true,
      _count: { select: { applications: true } },
      eligibilitySnapshots: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, createdAt: true } },
      applications: { select: { studentId: true } },
    },
  });

  const snapshotIds = drives.map((d) => d.eligibilitySnapshots[0]?.id).filter((id): id is string => Boolean(id));

  // One query for every drive's roster rather than N — these pages already
  // load a lot, and a company can easily have a dozen drives.
  const results = snapshotIds.length
    ? await db.eligibilityResult.findMany({
        where: { snapshotId: { in: snapshotIds } },
        select: { snapshotId: true, studentId: true, eligible: true },
      })
    : [];

  const overrides = await db.eligibilityOverride.findMany({
    where: { driveId: { in: drives.map((d) => d.id) }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "asc" },
    select: { driveId: true, studentId: true, decision: true },
  });
  const overrideByDriveStudent = new Map<string, string>();
  for (const o of overrides) overrideByDriveStudent.set(`${o.driveId}:${o.studentId}`, o.decision);

  const placedStudentIds = new Set(
    (
      await db.offer.findMany({
        where: { studentId: { in: results.map((r) => r.studentId) }, status: { in: [...PLACED_OFFER_STATUSES] } },
        select: { studentId: true },
      })
    ).map((o) => o.studentId),
  );

  const resultsBySnapshot = new Map<string, { studentId: string; eligible: boolean }[]>();
  for (const r of results) {
    const list = resultsBySnapshot.get(r.snapshotId) ?? [];
    list.push({ studentId: r.studentId, eligible: r.eligible });
    resultsBySnapshot.set(r.snapshotId, list);
  }

  const rows = drives.map((d) => {
    const snapshot = d.eligibilitySnapshots[0];
    const roster = snapshot ? (resultsBySnapshot.get(snapshot.id) ?? []) : [];
    const applied = new Set(d.applications.map((a) => a.studentId));

    // Same precedence as lib/eligibility-runner.ts: an active override wins
    // over whatever the published rule froze.
    const effective = roster.map((r) => {
      const decision = overrideByDriveStudent.get(`${d.id}:${r.studentId}`);
      return { studentId: r.studentId, eligible: decision ? decision === "ELIGIBLE" : r.eligible };
    });

    const eligible = effective.filter((r) => r.eligible);
    return {
      id: d.id,
      title: d.title,
      status: d.status,
      hasRule: Boolean(snapshot),
      evaluated: effective.length,
      eligibleCount: eligible.length,
      notEligibleCount: effective.length - eligible.length,
      appliedCount: d._count.applications,
      eligibleNotApplied: eligible.filter((r) => !applied.has(r.studentId)).length,
      eligiblePlaced: eligible.filter((r) => placedStudentIds.has(r.studentId)).length,
    };
  });

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          This company has no drives yet, so there is nothing to evaluate.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Eligibility is set per drive, so these are listed separately rather than combined — two drives from the same
        company can have completely different cut-offs. Open a drive to see the named students behind each number.
      </p>

      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/drives/${r.id}`} className="font-medium hover:underline">
                {r.title}
              </Link>
              <Badge variant="outline">{r.status.replaceAll("_", " ")}</Badge>
            </div>

            {!r.hasRule ? (
              <p className="text-muted-foreground text-sm">
                No eligibility rule published yet — publish one on the drive&apos;s Eligibility tab to see who qualifies.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat icon={Users} label="Evaluated" value={r.evaluated} />
                <Stat icon={CheckCircle2} label="Eligible" value={r.eligibleCount} tone="emerald" />
                <Stat icon={XCircle} label="Not eligible" value={r.notEligibleCount} tone="rose" />
                <Stat icon={Users} label="Applied" value={r.appliedCount} tone="sky" />
                <Stat icon={ShieldAlert} label="Yet to apply" value={r.eligibleNotApplied} tone="amber" />
              </div>
            )}

            {r.hasRule && r.eligiblePlaced > 0 && (
              <p className="text-muted-foreground text-xs">
                {r.eligiblePlaced} of the eligible students already hold an offer elsewhere — open the drive and use
                &ldquo;Exclude placed&rdquo; to filter them out.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const TONES: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  sky: "text-sky-600 dark:text-sky-400",
  amber: "text-amber-600 dark:text-amber-400",
};

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: keyof typeof TONES | string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className={`text-xl font-semibold tabular-nums ${tone ? (TONES[tone] ?? "") : ""}`}>{value}</span>
    </div>
  );
}
