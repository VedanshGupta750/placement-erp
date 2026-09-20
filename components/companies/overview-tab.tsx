import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  getCompanyFunnel,
  getCompanyPackageAnalytics,
  getCompanyEligiblePreviewCount,
  getCompanyNextFollowUp,
  getCompanyLastActivityAt,
} from "@/lib/companies/stats";
import { getCompanyHiringActivity } from "@/lib/contacts/stats";
import { computeCompanyHealthScore } from "@/lib/companies/health-score";
const BACKLOG_POLICY_LABELS: Record<string, string> = {
  NO_ACTIVE_BACKLOGS: "No active backlogs",
  UP_TO_1: "Up to 1 active backlog",
  UP_TO_2: "Up to 2 active backlogs",
  NO_RESTRICTION: "No restriction",
};

export async function OverviewTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { drives: { where: { collegeId: session.collegeId }, orderBy: { createdAt: "desc" }, take: 3, include: { _count: { select: { applications: true, offers: true } } } } },
  });
  if (!company) return null;

  const [funnel, packageStats, hiringActivity, eligibleCount, nextFollowUp, lastActivityAt, recruiters, hiredStudents] = await Promise.all([
    getCompanyFunnel(db, companyId),
    getCompanyPackageAnalytics(db, companyId),
    getCompanyHiringActivity(db, companyId),
    getCompanyEligiblePreviewCount(db, company),
    getCompanyNextFollowUp(db, companyId),
    getCompanyLastActivityAt(db, companyId),
    db.contact.findMany({ where: { companyId }, orderBy: { createdAt: "asc" }, take: 3 }),
    db.offer.findMany({
      where: { drive: { companyId }, status: { in: ["ACCEPTED", "JOINING_PENDING", "JOINED"] } },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const health = computeCompanyHealthScore({
    lastActivityAt,
    activeDriveCount: hiringActivity.activeDrives,
    studentsHiredLast12Months: hiringActivity.studentsHired,
    nextFollowUpAt: nextFollowUp?.nextFollowUpAt ?? null,
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle className="text-base">About Company</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {company.about && <p className="col-span-2 whitespace-pre-wrap">{company.about}</p>}
            <div><div className="text-muted-foreground text-xs">Industry</div><div>{company.industryType ?? "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">HQ Location</div><div>{company.headquarters ?? "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Company Size</div><div>{company.size ? `${company.size} employees` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Type</div><div>{company.companyType ?? "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Website</div><div>{company.website ? <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{company.website}</a> : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Founded</div><div>{company.foundedYear ?? "—"}</div></div>
            {company.tags.length > 0 && (
              <div className="col-span-2 flex flex-wrap gap-1.5">
                {company.tags.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Placement Funnel (All Time)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[
                { label: "Applications", value: funnel.applications },
                { label: "Shortlisted", value: funnel.shortlisted },
                { label: "Interviews", value: funnel.interviewed },
                { label: "Selected", value: funnel.selected },
                { label: "Offers", value: funnel.offers },
                { label: "Joined", value: funnel.joined },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-muted-foreground text-xs">{s.label}</div>
                  <div className="text-xl font-bold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 border-t pt-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Offer Rate</div>
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">{funnel.offerRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Joining Rate</div>
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">{funnel.joiningRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Drives</CardTitle>
            <span className="text-muted-foreground text-xs">{hiringActivity.activeDrives} active</span>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {company.drives.map((d: { id: string; title: string; status: string; _count: { applications: number; offers: number } }) => (
              <Link key={d.id} href={`/drives/${d.id}`} className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-2.5 transition-colors">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-muted-foreground text-xs">{d._count.applications} applications · {d._count.offers} offers</div>
                </div>
                <StatusBadge status={d.status} />
              </Link>
            ))}
            {company.drives.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No drives yet.</p>}
          </CardContent>
        </Card>

        {hiredStudents.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Previously Hired Students</CardTitle></CardHeader>
            <CardContent className="flex flex-col divide-y">
              {hiredStudents.map((o: { id: string; studentId: string; totalCompensation: unknown; student: { user: { name: string } } }) => (
                <Link key={o.id} href={`/students/${o.studentId}`} className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors">
                  <span>{o.student.user.name}</span>
                  <span className="text-muted-foreground tabular-nums">{o.totalCompensation != null ? `₹${(Number(o.totalCompensation) / 100000).toFixed(1)}L` : "—"}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Partner Health</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{health.score}</span>
              <span className="text-muted-foreground text-sm">/ 100</span>
            </div>
            <Badge variant="outline" className="w-fit">{health.label}</Badge>
            <p className="text-muted-foreground text-xs">
              System-generated indicator based on recent activity, active drives, hiring in the last 12 months, and follow-up status — not a fact.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-muted-foreground text-xs">Min CTC</div><div className="font-semibold">{packageStats.minCtc != null ? `₹${(packageStats.minCtc / 100000).toFixed(1)}L` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Max CTC</div><div className="font-semibold">{packageStats.maxCtc != null ? `₹${(packageStats.maxCtc / 100000).toFixed(1)}L` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Average CTC</div><div className="font-semibold">{packageStats.avgCtc != null ? `₹${(packageStats.avgCtc / 100000).toFixed(1)}L` : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">Median CTC</div><div className="font-semibold">{packageStats.medianCtc != null ? `₹${(packageStats.medianCtc / 100000).toFixed(1)}L` : "—"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Hiring Preference</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div><div className="text-muted-foreground text-xs">Hiring type</div><div>{company.hiringType ?? "Not set"}</div></div>
            <div><div className="text-muted-foreground text-xs">Min CGPA</div><div>{company.minCgpaPreference != null ? Number(company.minCgpaPreference) : "Not set"}</div></div>
            <div><div className="text-muted-foreground text-xs">Backlog policy</div><div>{company.backlogPolicy ? BACKLOG_POLICY_LABELS[company.backlogPolicy] ?? company.backlogPolicy : "Not set"}</div></div>
            <div className="border-t pt-2">
              <div className="text-muted-foreground text-xs">Estimated eligible students</div>
              <div className="text-lg font-bold tabular-nums">{eligibleCount}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recruiters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {recruiters.map((r: { id: string; name: string | null; designation: string | null }) => (
              <Link key={r.id} href={`/contacts/${r.id}`} className="hover:bg-accent/40 -mx-2 flex flex-col rounded-md px-2 py-2 text-sm transition-colors">
                <span className="font-medium">{r.name ?? "—"}</span>
                {r.designation && <span className="text-muted-foreground text-xs">{r.designation}</span>}
              </Link>
            ))}
            {recruiters.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No recruiters added yet.</p>}
          </CardContent>
        </Card>

        {nextFollowUp && (
          <Card>
            <CardContent className="flex flex-col gap-1 pt-6 text-sm">
              <div className="text-muted-foreground text-xs">Next follow-up</div>
              <div className="font-medium">{nextFollowUp.name ?? "Recruiter"} — {new Date(nextFollowUp.nextFollowUpAt!).toLocaleDateString("en-IN", { dateStyle: "medium" })}</div>
              {nextFollowUp.nextFollowUpNote && <p className="text-muted-foreground">{nextFollowUp.nextFollowUpNote}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
