import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BAR_COLORS = [
  "bg-zinc-400",
  "bg-blue-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-400",
];

const MIN_WIDTH_PCT = 6;

export function RelationshipStageFunnel({
  breakdown,
  activeStage,
}: {
  breakdown: { stage: string; label: string; count: number }[];
  activeStage?: string;
}) {
  const max = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Relationship Stage Funnel</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {breakdown.map((b, index) => {
          const widthPct = b.count > 0 ? Math.max((b.count / max) * 100, MIN_WIDTH_PCT) : 0;
          const isActive = activeStage === b.stage;
          return (
            <Link
              key={b.stage}
              href={isActive ? "/contacts" : `/contacts?relationshipStage=${b.stage}`}
              className={cn(
                "group flex items-center gap-3 rounded-md px-1 py-1 text-sm transition-colors hover:bg-muted",
                isActive && "bg-muted",
              )}
            >
              <span className="w-32 shrink-0 truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">
                {b.label}
              </span>
              <div className="flex h-6 flex-1 items-center">
                <div
                  className={cn("h-full min-w-[1.5rem] rounded-md flex items-center justify-end px-2", BAR_COLORS[index % BAR_COLORS.length])}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="text-xs font-bold tabular-nums text-white">{b.count}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
