import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

const POSITION_TYPE_LABELS: Record<string, string> = {
  JOB: "Job",
  INTERNSHIP: "Internship",
  JOB_AND_INTERNSHIP: "Job + Internship",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
  INTERNSHIP_PLUS_PPO: "Internship + PPO",
};

function formatCtc(minCtc: unknown, maxCtc: unknown): string | null {
  const min = minCtc != null ? Number(minCtc) : null;
  const max = maxCtc != null ? Number(maxCtc) : null;
  if (min == null && max == null) return null;
  const fmt = (v: number) => `₹${(v / 100000).toFixed(1)}L`;
  if (min != null && max != null && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}

function formatStipend(stipend: unknown): string | null {
  if (stipend == null) return null;
  return `₹${Number(stipend).toLocaleString("en-IN")}/mo`;
}

export async function DrivesTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const drives = await db.drive.findMany({
    where: { companyId, collegeId: session.collegeId },
    include: {
      positions: true,
      _count: { select: { applications: true, offers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (drives.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          No drives with this company yet.
        </CardContent>
      </Card>
    );
  }

  type DriveWithPositions = (typeof drives)[number];
  type Position = DriveWithPositions["positions"][number];

  return (
    <div className="flex flex-col gap-4">
      {drives.map((d: DriveWithPositions) => (
        <Card key={d.id}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/drives/${d.id}`} className="hover:underline">
                <CardTitle className="text-base">{d.title}</CardTitle>
              </Link>
              <StatusBadge status={d.status} />
            </div>
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span>{d.driveTypeLabel}</span>
              <span className="tabular-nums">{d._count.applications} applications</span>
              <span className="tabular-nums">{d._count.offers} offers</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {d.positions.length === 0 && (
              <p className="text-muted-foreground py-2 text-sm">No positions on this drive.</p>
            )}
            {d.positions.map((p: Position) => {
              const ctc = formatCtc(p.minCtc, p.maxCtc);
              const stipend = formatStipend(p.stipend);
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {POSITION_TYPE_LABELS[p.positionType] ?? p.positionType} · {EMPLOYMENT_TYPE_LABELS[p.employmentType] ?? p.employmentType}
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    {ctc && <span className="tabular-nums">{ctc}</span>}
                    {stipend && <span className="tabular-nums">{stipend}</span>}
                    {p.openings != null && <span className="tabular-nums">{p.openings} openings</span>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
