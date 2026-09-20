import Link from "next/link";
import {
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Gift,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionItem } from "@/lib/dashboard/get-action-items";

const ICON_THEME: Record<ActionItem["icon"], { icon: LucideIcon; classes: string }> = {
  approval: { icon: Clock, classes: "text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400" },
  interview: { icon: Calendar, classes: "text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400" },
  offer: { icon: Gift, classes: "text-primary bg-accent dark:bg-primary/15" },
  document: { icon: Users, classes: "text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400" },
  eligible: { icon: Users, classes: "text-sky-600 bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400" },
  company: { icon: Building2, classes: "text-slate-600 bg-slate-100 dark:bg-slate-500/15 dark:text-slate-400" },
};

export function ActionCenterCard({ items }: { items: ActionItem[] }) {
  return (
    <Card className="flex h-[26rem] flex-col">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <CardTitle>Action Center</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            All caught up — nothing needs your attention right now.
          </p>
        ) : (
          items.map((item) => {
            const theme = ICON_THEME[item.icon];
            const Icon = theme.icon;
            const [countText, ...titleRest] = item.title.split(" ");
            const restOfTitle = titleRest.join(" ");

            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${theme.classes}`}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    <span className="text-base font-bold">{countText}</span>{" "}
                    {restOfTitle}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
