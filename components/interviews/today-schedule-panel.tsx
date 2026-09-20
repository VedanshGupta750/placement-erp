import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

type Row = { id: string; time: string; studentName: string; companyName: string; roundName: string; status: string };

// Deliberately a simple sorted list, not a full day/week/month calendar
// grid — see the module commit message for why the calendar view itself
// was scoped out this round.
export function TodaysSchedulePanel({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Today&apos;s schedule</CardTitle></CardHeader>
      <CardContent className="flex flex-col divide-y">
        {rows.map((r) => (
          <Link key={r.id} href={`/interviews/${r.id}`} className="hover:bg-accent/40 flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-16 shrink-0 tabular-nums">{r.time}</span>
              <div>
                <div className="font-medium">{r.studentName}</div>
                <div className="text-muted-foreground text-xs">{r.companyName} · {r.roundName}</div>
              </div>
            </div>
            <StatusBadge status={r.status} />
          </Link>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No interviews scheduled today.</p>}
      </CardContent>
    </Card>
  );
}
