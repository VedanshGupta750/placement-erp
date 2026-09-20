import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReviewQueueTable } from "@/components/external-jobs/review-queue-table";
import { StudentExternalJobsList } from "@/components/external-jobs/student-external-jobs-list";

// A daily-review-sized queue, not an ever-growing inbox: the default view
// caps at DAILY_REVIEW_LIMIT, oldest-pending-first, so a TPO's review
// effort stays small and sustainable even as the backlog of filtered
// candidates grows. Nothing is ever discarded — every filtered candidate
// stays PENDING in the database; "Browse all pending" (?view=all) shows
// more of the backlog for a TPO who wants to clear more than today's 10.
const DAILY_REVIEW_LIMIT = 10;
// "Browse all" is still capped, not truly unbounded — rendering thousands
// of rows in one unpaginated table measured ~5.5s server-side and would be
// a genuinely bad table to scroll, which defeats the point of making the
// backlog reviewable. BROWSE_LIMIT keeps it fast; since approved/rejected
// rows leave PENDING immediately, working through BROWSE_LIMIT at a time
// and revisiting naturally clears the whole backlog over a few sessions.
const BROWSE_LIMIT = 200;

export default async function ExternalJobsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { userType: true } });

  if (user.userType === "STUDENT") {
    const reviews = await db.externalJobReview.findMany({
      where: { status: "APPROVED" },
      include: { posting: true },
      orderBy: { reviewedAt: "desc" },
    });

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">External Opportunities</h1>
          <p className="text-muted-foreground text-sm">
            Off-campus openings curated by your placement cell, in addition to campus drives.
          </p>
        </div>
        <StudentExternalJobsList
          rows={reviews.map((r) => ({
            id: r.id,
            company: r.posting.company,
            title: r.posting.title,
            location: r.posting.location,
            link: r.posting.link,
          }))}
        />
      </div>
    );
  }

  const canView = await hasPermission(session, "external_job.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          You don&apos;t have access to external job review.
        </CardContent>
      </Card>
    );
  }

  const showAll = params.view === "all";

  const [totalPending, approvedCount, rejectedCount, pendingRows] = await Promise.all([
    db.externalJobReview.count({ where: { status: "PENDING" } }),
    db.externalJobReview.count({ where: { status: "APPROVED" } }),
    db.externalJobReview.count({ where: { status: "REJECTED" } }),
    db.externalJobReview.findMany({
      where: { status: "PENDING" },
      include: { posting: true },
      orderBy: { createdAt: "asc" },
      take: showAll ? BROWSE_LIMIT : DAILY_REVIEW_LIMIT,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">External Fresher Jobs</h1>
        <p className="text-muted-foreground text-sm">
          Entry-level openings pulled daily from the external job market, filtered by keyword and auto-approved for
          your students. Use this queue if you ever want to reject one after the fact.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending review" value={totalPending} icon={Briefcase} color="amber" />
        <StatCard label="Approved" value={approvedCount} icon={Briefcase} color="emerald" />
        <StatCard label="Rejected" value={rejectedCount} icon={Briefcase} color="rose" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">
              {showAll
                ? `Browsing ${pendingRows.length} of ${totalPending} pending`
                : `Today's review queue (${pendingRows.length} of ${totalPending})`}
            </h2>
            {showAll ? (
              <Link href="/external-jobs" className="text-primary text-sm underline-offset-2 hover:underline">
                Back to today&apos;s queue
              </Link>
            ) : (
              totalPending > DAILY_REVIEW_LIMIT && (
                <Link href="/external-jobs?view=all" className="text-primary text-sm underline-offset-2 hover:underline">
                  Browse more pending ({totalPending} total)
                </Link>
              )
            )}
          </div>
          <ReviewQueueTable
            rows={pendingRows.map((r) => ({
              id: r.id,
              company: r.posting.company,
              title: r.posting.title,
              location: r.posting.location,
              link: r.posting.link,
              matchedKeywords: r.posting.matchedKeywords,
              firstSeenAt: r.posting.firstSeenAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
