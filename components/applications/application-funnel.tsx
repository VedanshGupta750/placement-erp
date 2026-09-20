type Stage = { label: string; count: number; conversionFromPrev?: number };

export function ApplicationFunnel({ stages }: { stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 text-sm font-medium">Conversion funnel</div>
      <div className="flex flex-col gap-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs text-muted-foreground">{s.label}</div>
            <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
              <div
                className="bg-primary/80 h-full rounded transition-all"
                style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }}
              />
            </div>
            <div className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">{s.count}</div>
            <div className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {i > 0 ? `${s.conversionFromPrev}%` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
