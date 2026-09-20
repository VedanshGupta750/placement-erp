import Link from "next/link";
import {
  UserPlus,
  Building2,
  Briefcase,
  Megaphone,
  Upload,
  FileBarChart,
  CalendarClock,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const ICON_BADGE_CLASSES = [
  "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Student", href: "/people", icon: UserPlus },
  { label: "Add Company", href: "/companies", icon: Building2 },
  { label: "Create Drive", href: "/drives/new", icon: Briefcase },
  { label: "Send Broadcast", href: "/broadcasts", icon: Megaphone },
  { label: "Upload Students", href: "/students/import", icon: Upload },
  { label: "Generate Report", href: "/reports", icon: FileBarChart },
  { label: "Schedule Interview", href: "/interviews", icon: CalendarClock },
  { label: "Create Event", href: "/events", icon: CalendarPlus },
];

export function QuickActionsCard() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }, index) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-colors hover:bg-accent/50"
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full ${ICON_BADGE_CLASSES[index % ICON_BADGE_CLASSES.length]}`}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-xs font-medium text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
