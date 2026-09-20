"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { InstallAppNavItem } from "@/components/pwa/install-app-nav-item";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileCheck2,
  BarChart3,
  Building2,
  UserPlus,
  MessageSquare,
  Users2,
  GraduationCap,
  FileText,
  Contact,
  Network,
  Settings,
  BookOpen,
  Calendar,
  Megaphone,
  ClipboardCheck,
  Video,
  CheckCircle2,
  LineChart,
  Lightbulb,
  TrendingUp,
  Lock,
  ScrollText,
  History,
  Globe2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; external?: boolean };

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/50")} />
      {item.label}
      {item.badge !== undefined && item.badge > 0 && (
        <span className="bg-primary text-primary-foreground ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function NavSection({ label, items, isActive }: { label: string; items: NavItem[]; isActive: (href: string) => boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-sidebar-foreground/40 mt-4 mb-1 px-2.5 text-[0.6875rem] font-semibold tracking-wider uppercase">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink key={`${item.href}-${item.label}`} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </div>
  );
}

export function SidebarNav({
  userType,
  isAdmin,
  opportunitiesCount,
  messagesCount,
  canViewAudit,
  canReviewExternalJobs,
  canViewFinance,
  pendingExternalJobsCount,
}: {
  userType: "STUDENT" | "FACULTY" | "MANAGEMENT" | "PLACEMENT_TEAM";
  isAdmin: boolean;
  opportunitiesCount?: number;
  messagesCount?: number;
  canViewAudit?: boolean;
  canReviewExternalJobs?: boolean;
  canViewFinance?: boolean;
  pendingExternalJobsCount?: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  if (userType === "STUDENT") {
    return (
      <nav>
        <InstallAppNavItem />
        <NavSection
          label="Placements"
          isActive={isActive}
          items={[
            { href: "/dashboard", label: "Home", icon: LayoutDashboard },
            { href: "/opportunities", label: "Opportunities", icon: Briefcase, badge: opportunitiesCount },
            { href: "/external-jobs", label: "External Opportunities", icon: Globe2 },
            { href: "/applications", label: "Applications", icon: FileText },
            { href: "/offers", label: "Offers", icon: FileCheck2 },
            { href: "/resumes", label: "Resumes", icon: FileText },
          ]}
        />
        <NavSection
          label="Network"
          isActive={isActive}
          items={[
            { href: "/network", label: "People", icon: Network },
            { href: "/messages", label: "Messages", icon: MessageSquare },
            { href: "/forums", label: "Forums", icon: Users2 },
            { href: "/events", label: "Events", icon: Calendar },
            { href: "/api/assessments/sso", label: "Assessments", icon: ClipboardCheck, external: true },
            { href: "/profile", label: "Profile", icon: GraduationCap },
          ]}
        />
      </nav>
    );
  }

  return (
    <nav>
      <InstallAppNavItem />
      <NavSection
        label="Placement Operations"
        isActive={isActive}
        items={[
          { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
          { href: "/students", label: "Students", icon: Users },
          { href: "/companies", label: "Companies", icon: Building2 },
          { href: "/contacts", label: "Contacts", icon: Contact },
          { href: "/drives", label: "Drives", icon: Briefcase },
          ...(canReviewExternalJobs
            ? [{ href: "/external-jobs", label: "External Jobs", icon: Globe2, badge: pendingExternalJobsCount }]
            : []),
          { href: "/applications", label: "Applications", icon: FileText },
          { href: "/interviews", label: "Interviews", icon: Video },
          { href: "/offers", label: "Job Offers", icon: FileCheck2 },
          { href: "/offers?type=internship", label: "Internship Offers", icon: GraduationCap },
          { href: "/offers?status=joining", label: "Joining", icon: CheckCircle2 },
        ]}
      />
      <NavSection
        label="Intelligence"
        isActive={isActive}
        items={[
          { href: "/analytics", label: "Analytics", icon: LineChart },
          { href: "/insights", label: "Placement Insights", icon: Lightbulb },
          { href: "/reports", label: "Reports", icon: BarChart3 },
          { href: "/forecasts", label: "Forecasts", icon: TrendingUp },
          ...(canViewFinance ? [{ href: "/finance", label: "Finance", icon: Wallet }] : []),
          ...(canViewAudit ? [{ href: "/audit", label: "Audit Log", icon: History }] : []),
        ]}
      />
      <NavSection
        label="Engagement"
        isActive={isActive}
        items={[
          { href: "/network", label: "Network", icon: Network },
          { href: "/messages", label: "Messages", icon: MessageSquare, badge: messagesCount },
          { href: "/forums", label: "Forums", icon: Users2 },
          { href: "/broadcasts", label: "Broadcasts", icon: Megaphone },
          { href: "/events", label: "Events", icon: Calendar },
          ...(userType === "PLACEMENT_TEAM" ? [{ href: "/api/assessments/sso", label: "Assessments", icon: ClipboardCheck, external: true }] : []),
        ]}
      />
      {isAdmin && (
        <NavSection
          label="Administration"
          isActive={isActive}
          items={[
            { href: "/departments", label: "Departments", icon: Building2 },
            { href: "/courses", label: "Courses", icon: BookOpen },
            { href: "/people", label: "People & Invites", icon: UserPlus },
            { href: "/roles", label: "Roles & Permissions", icon: Lock },
            { href: "/categories", label: "Placement Policies", icon: ScrollText },
            { href: "/settings", label: "Settings", icon: Settings },
          ]}
        />
      )}
    </nav>
  );
}
