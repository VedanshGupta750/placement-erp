import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { label: string; count: number };

export function OfferDepartmentPanel({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Placements by department</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums font-medium">{r.count}</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No accepted or joined offers yet.</p>}
      </CardContent>
    </Card>
  );
}
