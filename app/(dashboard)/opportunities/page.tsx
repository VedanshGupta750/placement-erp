import Link from "next/link";
import { Briefcase, MapPin, CalendarClock } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";

// Statuses a student is ever allowed to see — never DRAFT/PENDING_APPROVAL/
// APPROVED (those are still internal to the TPO console).
const VISIBLE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SELECTION_ONGOING", "COMPLETED"] as const;

function ctcRange(positions: { minCtc: unknown; maxCtc: unknown }[]) {
  const mins = positions.map((p) => (p.minCtc !== null ? Number(p.minCtc) : null)).filter((n): n is number => n !== null);
  const maxes = positions.map((p) => (p.maxCtc !== null ? Number(p.maxCtc) : null)).filter((n): n is number => n !== null);
  if (mins.length === 0 && maxes.length === 0) return null;
  const min = mins.length ? Math.min(...mins) : undefined;
  const max = maxes.length ? Math.max(...maxes) : undefined;
  if (min && max) return `₹${(min / 100000).toFixed(1)}L – ₹${(max / 100000).toFixed(1)}L`;
  if (max) return `Up to ₹${(max / 100000).toFixed(1)}L`;
  if (min) return `From ₹${(min / 100000).toFixed(1)}L`;
  return null;
}

export default async function OpportunitiesPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({
    where: { userId: session.userId },
    select: { id: true, courseId: true, eligibleForPlacements: true, hasPlacementAccess: true },
  });

  if (!student) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-muted-foreground text-sm">No student profile is linked to your account yet.</p>
      </div>
    );
  }

  const canSeeOpportunities = student.eligibleForPlacements && student.hasPlacementAccess;

  const drives = canSeeOpportunities
    ? await db.drive.findMany({
        where: {
          status: { in: [...VISIBLE_STATUSES] },
          eligibleCourses: { some: { courseId: student.courseId } },
        },
        include: {
          company: true,
          positions: true,
          requiredSkills: { include: { skill: true } },
          applications: { where: { studentId: student.id }, select: { id: true, status: true } },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-muted-foreground text-sm">{drives.length} drive{drives.length === 1 ? "" : "s"} you&apos;re eligible for.</p>
      </div>

      {!canSeeOpportunities && (
        <Card className="border-none bg-amber-50 shadow-none dark:bg-amber-500/10">
          <CardContent className="text-sm text-amber-700 dark:text-amber-400">
            You currently don&apos;t have access to placement opportunities. Contact your placement office if you think this is a mistake.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {drives.map((d) => {
          const applied = d.applications[0];
          const range = ctcRange(d.positions);
          const positionTypes = Array.from(new Set(d.positions.map((p) => p.positionType)));
          return (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/opportunities/${d.id}`} className="font-semibold hover:underline">
                      {d.title}
                    </Link>
                    <div className="text-muted-foreground text-sm">{d.company.name}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {positionTypes.map((t) => (
                    <Badge key={t} variant="outline">{t.replaceAll("_", " ")}</Badge>
                  ))}
                  {range && <Badge variant="outline">{range}</Badge>}
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {d.locationCategory.replaceAll("_", " ")}
                  </span>
                  {d.registrationClosesAt && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="size-3.5" /> Closes {new Date(d.registrationClosesAt).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </div>

                {d.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {d.requiredSkills.slice(0, 6).map((s) => (
                      <Badge key={s.skillId} variant="secondary">{s.skill.name}</Badge>
                    ))}
                  </div>
                )}

                <div className="mt-1 flex justify-end">
                  {applied ? (
                    <Button size="sm" variant="outline" render={<Link href={`/opportunities/${d.id}`} />}>
                      <StatusBadge status={applied.status} />
                    </Button>
                  ) : (
                    <Button size="sm" render={<Link href={`/opportunities/${d.id}`} />}>
                      View & apply
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {canSeeOpportunities && drives.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <Briefcase className="size-6" />
              No open drives match your course right now. Check back soon.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
