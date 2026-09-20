import { Card, CardContent } from "@/components/ui/card";

const STAT_THEME = {
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-500/10", icon: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" },
  rose: { bg: "bg-rose-50 dark:bg-rose-500/10", icon: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-500/10", icon: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" },
  sky: { bg: "bg-sky-50 dark:bg-sky-500/10", icon: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-500/10", icon: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" },
  teal: { bg: "bg-teal-50 dark:bg-teal-500/10", icon: "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400" },
} as const;

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ElementType;
  color: keyof typeof STAT_THEME;
}) {
  const theme = STAT_THEME[color];
  return (
    <Card className={`h-full ${theme.bg} border-none shadow-none`}>
      <CardContent className="flex h-full flex-col gap-2 pt-6">
        {/* Icon on its own row, label full-width beneath it. Side-by-side,
            the label only got ~110px next to the icon in the 6-across grid,
            so "Registration Open" and "Published" were breaking mid-word.
            Full width lets them wrap at spaces, or not wrap at all. */}
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${theme.icon}`}>
          <Icon className="size-[1.125rem]" />
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground text-sm leading-snug" title={label}>
            {label}
          </div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
          {sublabel && <div className="text-muted-foreground mt-0.5 text-xs leading-snug">{sublabel}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
