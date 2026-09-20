import Link from "next/link";
import { Users, UserCheck, GraduationCap, TrendingUp, AlertTriangle, UserX } from "lucide-react";

type Kpi = { label: string; value: string; sub?: string; href?: string; icon: typeof Users; color: string };

// Every card is a link into the list pre-filtered to match — clicking
// "Unplaced" filters the list to unplaced students, per the spec.
export function KpiCards({
  total,
  eligible,
  placed,
  avgCgpa,
  withBacklogs,
  unplaced,
}: {
  total: number;
  eligible: number;
  placed: number;
  avgCgpa: number | null;
  withBacklogs: number;
  unplaced: number;
}) {
  const placementRate = total > 0 ? ((placed / total) * 100).toFixed(1) : "0.0";

  const cards: Kpi[] = [
    { label: "Total Students", value: String(total), href: "/students", icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400" },
    { label: "Eligible", value: String(eligible), href: "/students?eligible=1", icon: UserCheck, color: "text-violet-600 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400" },
    { label: "Placed", value: String(placed), sub: `${placementRate}%`, href: "/students?placementStatus=PLACED", icon: GraduationCap, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400" },
    { label: "Placement Rate", value: `${placementRate}%`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400" },
    { label: "Avg. CGPA", value: avgCgpa != null ? avgCgpa.toFixed(2) : "—", icon: TrendingUp, color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-400" },
    { label: "With Backlogs", value: String(withBacklogs), href: "/students?hasBacklogs=1", icon: AlertTriangle, color: "text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400" },
    { label: "Unplaced", value: String(unplaced), href: "/students?tab=not-placed", icon: UserX, color: "text-red-600 bg-red-100 dark:bg-red-500/15 dark:text-red-400" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const content = (
          <div className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/40">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${c.color}`}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs leading-snug">{c.label}</div>
              <div className="text-lg font-semibold tabular-nums">{c.value}</div>
              {c.sub && <div className="text-muted-foreground text-xs">{c.sub}</div>}
            </div>
          </div>
        );
        return c.href ? <Link key={c.label} href={c.href}>{content}</Link> : <div key={c.label}>{content}</div>;
      })}
    </div>
  );
}
