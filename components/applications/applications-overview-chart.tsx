import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEGMENT_CLASSES: Record<string, string> = {
  Applied: "bg-zinc-400",
  Shortlisted: "bg-violet-500",
  Selected: "bg-emerald-500",
  "In Progress": "bg-amber-500",
  Rejected: "bg-rose-500",
  Withdrawn: "bg-zinc-300",
};

// A plain proportional stacked bar, not a real donut chart — no charting
// library dependency added just for one page. Every segment is a real
// count, same data the status tabs above already use.
export function ApplicationsOverviewChart({ total, segments }: { total: number; segments: { label: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Application Overview</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-2xl font-bold tabular-nums">{total.toLocaleString("en-IN")}</div>
        <div className="bg-muted flex h-3 overflow-hidden rounded-full">
          {segments.map((s) => (
            <div
              key={s.label}
              className={SEGMENT_CLASSES[s.label] ?? "bg-muted-foreground"}
              style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${SEGMENT_CLASSES[s.label] ?? "bg-muted-foreground"}`} />
                {s.label}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {s.count} ({total > 0 ? Math.round((s.count / total) * 1000) / 10 : 0}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
