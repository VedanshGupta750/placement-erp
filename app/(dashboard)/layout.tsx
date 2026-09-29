import Link from "next/link";
import { CalendarDays, Contact, Home, MessageCircleQuestion, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { CopilotWidget } from "@/components/ai/copilot-widget";
import { BatchSwitcher } from "@/components/dashboard/batch-switcher";
import { FloatingCreateButton } from "@/components/dashboard/floating-create-button";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { LogoMark } from "@/components/dashboard/logo-mark";
import { getActiveBatchId } from "@/lib/batch-context";
import { PWA_CONFIG } from "@/lib/pwa/config";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      avatarUrl: true,
      userType: true,
      mustChangePassword: true,
      role: { select: { name: true } },
      college: { select: { name: true, logoUrl: true } },
      departmentMemberships: { select: { isAdmin: true } },
    },
  });

  // Nothing in the app loads while the account still holds the password the
  // placement cell set — a predictable starter password must be usable
  // exactly once. /first-password sits outside this layout so it can render.
  if (user.mustChangePassword) redirect("/first-password");

  let opportunitiesCount: number | undefined;
  if (user.userType === "STUDENT") {
    const student = await db.student.findUnique({
      where: { userId: session.userId },
      select: { id: true, courseId: true, eligibleForPlacements: true, opportunitiesSeenAt: true },
    });
    if (student) {
      // Drives this student could still ACT on: open to their course and
      // not already applied to. The previous version counted every open
      // matching drive, so the badge never went down after applying — and
      // it ran an application.count() whose result was thrown away.
      // An unread-style badge: only drives that appeared since this student
      // last opened the list. Counting every open drive meant the badge
      // never moved no matter how often they looked at it.
      opportunitiesCount = student.eligibleForPlacements
        ? await db.drive.count({
            where: {
              status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] },
              eligibleCourses: { some: { courseId: student.courseId } },
              applications: { none: { studentId: student.id } },
              ...(student.opportunitiesSeenAt
                ? {
                    OR: [
                      { publishedAt: { gt: student.opportunitiesSeenAt } },
                      { publishedAt: null, createdAt: { gt: student.opportunitiesSeenAt } },
                    ],
                  }
                : {}),
            },
          })
        : 0;
    }
  }

  const isAdmin = user.departmentMemberships.some((m) => m.isAdmin);
  const showCopilot = user.userType !== "STUDENT" && (await hasPermission(session, "report.view"));
  const canViewAudit = user.userType !== "STUDENT" && (await hasPermission(session, "audit.view"));
  const showStaffTools = user.userType !== "STUDENT";
  const canReviewExternalJobs = showStaffTools && (await hasPermission(session, "external_job.view"));
  // Academic corrections a student has raised and nobody has actioned.
  // Shown on the Students nav item so the queue is visible without opening
  // students one at a time.
  const pendingAcademicRequestsCount =
    user.userType !== "STUDENT"
      ? await db.academicChangeRequest.count({ where: { status: "PENDING" } })
      : undefined;

  const pendingExternalJobsCount = canReviewExternalJobs
    ? await db.externalJobReview.count({ where: { status: "PENDING" } })
    : undefined;
  const canViewFinance = showStaffTools && (await hasPermission(session, "finance.view"));

  let batches: { id: string; year: number }[] = [];
  let activeBatchId: string | null = null;
  if (showStaffTools) {
    [batches, activeBatchId] = await Promise.all([
      db.batch.findMany({ select: { id: true, year: true }, orderBy: { year: "desc" } }),
      getActiveBatchId(),
    ]);
  }

  return (
    <DashboardShell
      orgName={user.college.name}
      orgLogoUrl={user.college.logoUrl}
      userType={user.userType}
      logo={
        <>
          <LogoMark className="h-7 w-12 shrink-0" />
          <span className="text-[1.05rem] leading-none font-semibold tracking-tight">{PWA_CONFIG.name}</span>
        </>
      }
      nav={
        <SidebarNav
          userType={user.userType}
          isAdmin={isAdmin}
          opportunitiesCount={opportunitiesCount}
          canViewAudit={canViewAudit}
          canReviewExternalJobs={canReviewExternalJobs}
          pendingExternalJobsCount={pendingExternalJobsCount}
          pendingAcademicRequestsCount={pendingAcademicRequestsCount}
          canViewFinance={canViewFinance}
        />
      }
      headerCenter={
        showStaffTools ? (
          <div className="flex w-full max-w-2xl min-w-0 items-center gap-2">
            <GlobalSearch />
            <div className="hidden shrink-0 sm:block lg:hidden 2xl:block">
              <BatchSwitcher batches={batches} activeBatchId={activeBatchId} />
            </div>
          </div>
        ) : undefined
      }
      headerRight={
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/dashboard"
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground hidden size-8 items-center justify-center rounded-lg transition-colors min-[2100px]:flex"
                  aria-label="Home"
                />
              }
            >
              <Home className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Home</TooltipContent>
          </Tooltip>
          {showStaffTools && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/contacts"
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground hidden size-8 items-center justify-center rounded-lg transition-colors min-[2100px]:flex"
                    aria-label="Contacts"
                  />
                }
              >
                <Contact className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Contacts</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/messages"
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground hidden size-8 items-center justify-center rounded-lg transition-colors min-[2100px]:flex"
                  aria-label="Messages"
                />
              }
            >
              <MessageSquare className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Messages</TooltipContent>
          </Tooltip>
          <div className="bg-border mx-1 hidden h-6 w-px min-[2100px]:block" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/events"
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground hidden size-8 items-center justify-center rounded-lg transition-colors min-[2100px]:flex"
                  aria-label="Events calendar"
                />
              }
            >
              <CalendarDays className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Events calendar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href="mailto:support@placement-erp.local"
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground hidden size-8 items-center justify-center rounded-lg transition-colors min-[2100px]:flex"
                  aria-label="Help"
                />
              }
            >
              <MessageCircleQuestion className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Help & support</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <NotificationBell />
          <div className="bg-border mx-1 hidden h-6 w-px min-[2100px]:block" />
          <UserMenu name={user.name} email={user.email} role={user.role?.name ?? user.userType} avatarUrl={user.avatarUrl} />
        </div>
      }
    >
      {children}
      {showStaffTools && <FloatingCreateButton showCopilot={showCopilot} />}
      {showCopilot && <CopilotWidget />}
    </DashboardShell>
  );
}
