import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/status-badge";

export type CalendarEntry = {
  id: string;
  time: string;
  studentName: string;
  companyName: string;
  roundName: string;
  status: string;
};

export function CalendarEntryCard({ entry }: { entry: CalendarEntry }) {
  return (
    <Link href={`/interviews/${entry.id}`} className="hover:bg-accent/60 flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium tabular-nums">{entry.time}</span>
        <StatusBadge status={entry.status} className="text-[10px]" />
      </div>
      <div className="truncate font-medium">{entry.studentName}</div>
      <div className="text-muted-foreground truncate">{entry.companyName} · {entry.roundName}</div>
    </Link>
  );
}
