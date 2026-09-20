import Link from "next/link";
import {
  Users,
  Briefcase,
  FileCheck2,
  TrendingUp,
  ArrowRight,
  FileText,
  Sparkles,
  UserCheck,
  Gift,
  IndianRupee,
  Settings,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { getActiveBatchId } from "@/lib/batch-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationInlineCard } from "@/components/dashboard/notification-inline-card";
import { getOverviewStats } from "@/lib/dashboard/get-stat-cards";
import { getActionItems } from "@/lib/dashboard/get-action-items";
import { getAttentionStudents } from "@/lib/dashboard/get-attention-students";
import { getFunnelData } from "@/lib/dashboard/get-funnel-data";
import { getActiveDrives } from "@/lib/dashboard/get-active-drives";
import { ActionCenterCard } from "@/components/dashboard/action-center-card";
import { AttentionStudentsCard } from "@/components/dashboard/attention-students-card";
import { PlacementFunnelCard } from "@/components/dashboard/placement-funnel-card";
import { ActiveDrivesCard } from "@/components/dashboard/active-drives-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";
import { BudgetUtilizationCard } from "@/components/dashboard/budget-utilization-card";
import { getBudgetSummary } from "@/lib/budget/get-budget-summary";

export default async function DashboardPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { userType: true, name: true } });

  if (user.userType === "STUDENT") {
    const student = await db.student.findUnique({
      where: { userId: session.userId },
      select: { id: true, courseId: true, eligibleForPlacements: true },
    });

    const [opportunities, applications, offers, recentDrives, defaultResume, resumeCount, recentNotifications] = await Promise.all([
      student?.eligibleForPlacements
        ? db.drive.count({ where: { status: "PUBLISHED", eligibleCourses: { some: { courseId: student.courseId } } } })
        : Promise.resolve(0),
      student ? db.application.count({ where: { studentId: student.id } }) : Promise.resolve(0),
      student ? db.offer.count({ where: { studentId: student.id } }) : Promise.resolve(0),
      db.drive.findMany({
        where: { status: "PUBLISHED", ...(student ? { eligibleCourses: { some: { courseId: student.courseId } } } : {}) },
        orderBy: { publishedAt: "desc" },
        take: 5,
        include: { company: true },
      }),
      student ? db.resume.findFirst({ where: { studentId: student.id, isDefault: true } }) : Promise.resolve(null),
      student ? db.resume.count({ where: { studentId: student.id } }) : Promise.resolve(0),
      db.notification.findMany({ where: { userId: session.userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm">Here&apos;s what&apos;s open for you right now.</p>
        </div>

        {recentNotifications.length > 0 && (
          <div className="flex flex-col gap-2">
            {recentNotifications.map((n) => (
              <NotificationInlineCard key={n.id} id={n.id} title={n.title} body={n.body} link={n.link} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard icon={Briefcase} label="Opportunities" value={opportunities} sublabel="you're eligible for" color="blue" />
          <StatCard icon={FileCheck2} label="Applications" value={applications} sublabel="submitted" color="amber" />
          <StatCard icon={TrendingUp} label="Offers" value={offers} sublabel="in hand" color="emerald" />
          <Card>
            <CardContent className="flex h-full flex-col justify-between gap-2 pt-6">
              <div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <FileText className="size-4" /> Resume
                </div>
                <div className="mt-1 text-sm font-medium">
                  {defaultResume ? defaultResume.name : "No default resume set"}
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-fit" render={<Link href="/resumes" />}>
                <Sparkles className="size-3.5" /> {resumeCount > 0 ? "Manage resumes" : "Generate resume"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest opportunities</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/opportunities" />}>
                View all <ArrowRight className="size-3.5" />
</Button>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {recentDrives.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No open drives right now.</p>}
            {recentDrives.map((d) => (
              <Link key={d.id} href={`/opportunities/${d.id}`} className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-3 transition-colors">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-muted-foreground text-sm">{d.company.name}</div>
                </div>
                <StatusBadge status={d.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // TPO / staff overview
  const activeBatchId = await getActiveBatchId();
  const canViewFinance = await hasPermission(session, "finance.view");
  const [stats, actionItems, attentionStudents, funnelStages, activeDrives, budgetSummary] = await Promise.all([
    getOverviewStats(db, activeBatchId),
    getActionItems(db, session.collegeId, activeBatchId),
    getAttentionStudents(db, session.collegeId, 8, activeBatchId),
    getFunnelData(db, session.collegeId, activeBatchId),
    getActiveDrives(db, session.collegeId, activeBatchId),
    canViewFinance ? getBudgetSummary(db, session.collegeId) : Promise.resolve(null),
  ]);

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const firstName = user.name.split(" ")[0];
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {firstName}! 👋</h1>
          <p className="text-muted-foreground text-sm">Here&apos;s what&apos;s happening with placements today.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs lg:flex">
            {today} – {today}
          </span>
          <Button variant="outline" render={<Link href="/settings" />}>
            <Settings className="size-4" /> Customize
          </Button>
          <Button render={<Link href="/drives/new" />}>
            <Briefcase className="size-4" /> New drive
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 min-[360px]:grid-cols-2 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Students" value={stats.totalStudents} color="blue" />
        <StatCard icon={UserCheck} label="Eligible Students" value={stats.eligibleStudents} sublabel={`${stats.eligiblePct}% of total`} color="violet" />
        <StatCard
          icon={Briefcase}
          label="Active Drives"
          value={stats.activeDrives}
          sublabel={stats.closingSoon > 0 ? `${stats.closingSoon} closing this week` : undefined}
          color="indigo"
        />
        <StatCard
          icon={FileText}
          label="Applications"
          value={stats.totalApplications}
          sublabel={stats.pendingApproval > 0 ? `${stats.pendingApproval} pending approval` : undefined}
          color="sky"
        />
        <StatCard
          icon={Gift}
          label="Offers Issued"
          value={stats.offersIssuedCount}
          sublabel={stats.offersAwaiting > 0 ? `${stats.offersAwaiting} awaiting response` : undefined}
          color="teal"
        />
        <StatCard icon={UserCheck} label="Placed Students" value={stats.placedCount} sublabel={`${stats.placedPctOfTotal}% of total`} color="emerald" />
        <StatCard icon={TrendingUp} label="Placement Rate" value={`${stats.placementRatePct}%`} sublabel="Based on eligible" color="amber" />
        <StatCard
          icon={IndianRupee}
          label="Avg Package"
          value={`₹${stats.avgPackageLakh}L`}
          sublabel={stats.medianPackageLakh > 0 ? `Median ₹${stats.medianPackageLakh}L` : undefined}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ActionCenterCard items={actionItems} />
        <PlacementFunnelCard stages={funnelStages} />
      </div>

      <ActiveDrivesCard drives={activeDrives} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttentionStudentsCard students={attentionStudents} />
        </div>
        <QuickActionsCard />
      </div>

      {budgetSummary && <BudgetUtilizationCard summary={budgetSummary} />}
    </div>
  );
}
