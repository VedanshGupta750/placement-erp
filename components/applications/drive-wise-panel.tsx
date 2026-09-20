import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { driveId: string; label: string; count: number };

export function DriveWisePanel({ rows, maxCount }: { rows: Row[]; maxCount: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Drive-wise Applications</CardTitle>
        <Link href="/drives" className="text-primary text-xs font-medium hover:underline">View All</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r) => (
          <Link key={r.driveId} href={`/applications?driveId=${r.driveId}`} className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums font-medium">{r.count}</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full" style={{ width: `${maxCount > 0 ? (r.count / maxCount) * 100 : 0}%` }} />
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No applications yet.</p>}
      </CardContent>
    </Card>
  );
}
