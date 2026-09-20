import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BAR_COLORS = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-cyan-500", "bg-pink-500"];

export function DepartmentDistributionChart({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Department-wise Distribution</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No students yet.</p>}
        {rows.map((r, i) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-sm">{r.label}</div>
              <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
                <div className={`flex h-full items-center justify-end rounded px-1.5 ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }}>
                  <span className="text-[10px] font-semibold text-white">{r.count}</span>
                </div>
              </div>
              <div className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">{pct}%</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
