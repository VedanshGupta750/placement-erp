import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { label: string; count: number; pct: number };

export function PipelineOverviewPanel({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Interview pipeline</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="truncate">{r.label}</span>
              <span className="text-muted-foreground tabular-nums">{r.count} ({r.pct}%)</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No interview rounds yet.</p>}
      </CardContent>
    </Card>
  );
}
