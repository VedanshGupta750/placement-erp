import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export type CalendarEvent = {
  driveId: string;
  title: string;
  companyName: string;
  date: Date;
  kind: "Registration closes" | "Drive date" | "Selection starts";
};

const KIND_CLASSES: Record<CalendarEvent["kind"], string> = {
  "Registration closes": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Drive date": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  "Selection starts": "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
};

// A plain month grid built from real Drive dates passed in by the server
// page — no client-side date library, just calendar math over a fixed
// (year, month). Deliberately label-based, not color-only, per this
// session's "clear labels + accessible indicators, not color-only status"
// instruction.
export function DrivesCalendar({ year, month, events }: { year: number; month: number; events: CalendarEvent[] }) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    if (e.date.getFullYear() === year && e.date.getMonth() === month) {
      const day = e.date.getDate();
      eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), e]);
    }
  }

  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstOfMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{monthLabel}</h2>
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/50 text-muted-foreground grid grid-cols-7 text-center text-xs font-medium">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => (
            <div key={i} className="min-h-28 border-t border-l p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0">
              {day && (
                <>
                  <div className="text-muted-foreground text-xs">{day}</div>
                  <div className="mt-1 flex flex-col gap-1">
                    {(eventsByDay.get(day) ?? []).map((e, idx) => (
                      <Link key={idx} href={`/drives/${e.driveId}`} className="block">
                        <Badge className={`w-full justify-start truncate border-none text-[10px] font-normal ${KIND_CLASSES[e.kind]}`}>
                          {e.kind}: {e.companyName}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
