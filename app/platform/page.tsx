import Link from "next/link";
import { Activity, Building2, ScrollText, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePlatformSession } from "@/lib/auth/platform-session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateCollegeDialog } from "@/components/platform/create-college-dialog";
import { ResetTpoButton } from "@/components/platform/reset-tpo-button";
import { PlatformSignOutButton } from "@/components/platform/platform-sign-out-button";
import { PLATFORM_AUDIT_LABELS } from "@/lib/auth/platform-audit";
import { AUDIT_LABELS } from "@/lib/audit";

export const metadata = {
  title: "Platform console",
  robots: { index: false, follow: false },
};

// The operator's cross-tenant console. This is the ONE place in the app
// that deliberately reads across colleges, which is why it uses `prisma`
// directly instead of getTenantDb — requirePlatformSession is the boundary.
export default async function PlatformConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ college?: string }>;
}) {
  const { college: collegeFilter } = await searchParams;
  const admin = await requirePlatformSession();

  const colleges = await prisma.college.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });

  const totalUsers = colleges.reduce((sum, c) => sum + c._count.users, 0);

  // Most recent operator activity. Shown in the console itself so the
  // trail is actually read, rather than only existing in a table nobody
  // queries until after an incident.
  const auditEntries = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  // Cross-tenant activity. This is the only place in the app that reads
  // AuditLog across colleges — every tenant surface is scoped by
  // getTenantDb, which is exactly why an operator otherwise has to sign
  // into each college one at a time to answer "what happened?".
  const collegeIdFilter = collegeFilter && colleges.some((c) => c.id === collegeFilter) ? collegeFilter : undefined;
  const collegeActivity = await prisma.auditLog.findMany({
    where: collegeIdFilter ? { collegeId: collegeIdFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      action: true,
      resourceType: true,
      createdAt: true,
      college: { select: { name: true } },
      actor: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform console</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {admin.name} ({admin.email})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateCollegeDialog />
          <PlatformSignOutButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <Building2 className="size-5" />
            </span>
            <div>
              <div className="text-muted-foreground text-sm">Colleges</div>
              <div className="text-2xl font-semibold tabular-nums">{colleges.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Users className="size-5" />
            </span>
            <div>
              <div className="text-muted-foreground text-sm">Users across all colleges</div>
              <div className="text-2xl font-semibold tabular-nums">{totalUsers}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y pt-6">
          {colleges.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {c.slug} · {c._count.users} user{c._count.users === 1 ? "" : "s"} · created{" "}
                  {c.createdAt.toLocaleDateString("en-IN")}
                </p>
              </div>
              <ResetTpoButton collegeId={c.id} collegeName={c.name} />
            </div>
          ))}
          {colleges.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No colleges yet. Use “New college” to create the first one.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <ScrollText className="text-muted-foreground size-4" />
            <h2 className="font-medium">Recent operator activity</h2>
          </div>
          <div className="flex flex-col divide-y">
            {auditEntries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{PLATFORM_AUDIT_LABELS[e.action] ?? e.action}</span>
                  {e.targetLabel && <span className="text-muted-foreground"> · {e.targetLabel}</span>}
                  <div className="text-muted-foreground text-xs">
                    {e.actorEmail}
                    {e.ip ? ` · ${e.ip}` : ""}
                  </div>
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {e.createdAt.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            {auditEntries.length === 0 && (
              <p className="text-muted-foreground py-4 text-sm">
                No operator activity recorded yet. Signing in or out of this console, creating a college or resetting a
                TPO will appear here.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="text-muted-foreground size-4" />
              <h2 className="font-medium">Activity across all colleges</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href="/platform"
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${!collegeIdFilter ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                All
              </Link>
              {colleges.map((c) => (
                <Link
                  key={c.id}
                  href={`/platform?college=${c.id}`}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${collegeIdFilter === c.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {c.name.length > 24 ? `${c.name.slice(0, 24)}…` : c.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            <div className="flex flex-col divide-y">
              {collegeActivity.map((e) => (
                <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{AUDIT_LABELS[e.action] ?? e.action}</span>
                    <div className="text-muted-foreground text-xs">
                      {e.college.name}
                      {e.actor ? ` · ${e.actor.name}` : ""}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {e.createdAt.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
              {collegeActivity.length === 0 && (
                <p className="text-muted-foreground py-4 text-sm">No college activity recorded for this filter.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
