import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "people", label: "People" },
  { key: "groups", label: "Groups" },
  { key: "teams", label: "Teams" },
  { key: "alumni", label: "Alumni" },
  { key: "recruiters", label: "Recruiters" },
];

export function NetworkTabs({ active, hrefWith, counts }: { active: string; hrefWith: (overrides: Record<string, string | undefined>) => string; counts: Record<string, number> }) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto border-b [scrollbar-width:thin]">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={hrefWith({ tab: t.key === "people" ? undefined : t.key })}
          scroll={false}
          className={cn(
            "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            active === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label} {counts[t.key] !== undefined && <span className="text-muted-foreground">{counts[t.key]}</span>}
        </Link>
      ))}
    </div>
  );
}
