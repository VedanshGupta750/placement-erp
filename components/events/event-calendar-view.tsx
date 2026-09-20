"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EVENT_CATEGORY_LABEL } from "@/lib/events/status";

export type CalendarEvent = {
  id: string;
  title: string;
  category: string;
  startAt: string; // ISO
};

// A deliberately simple month grid built from scratch with CSS grid — no
// calendar library is installed in this app and none should be added for
// this. Events render as a colored dot per category on their startAt date;
// clicking a day (when it has events) or an event pill navigates to the
// event's detail page.
const CATEGORY_DOT_CLASS: Record<string, string> = {
  EXPERT_SESSION: "bg-blue-500",
  WORKSHOP: "bg-purple-500",
  COMPETITION: "bg-amber-500",
  HACKATHON: "bg-pink-500",
  WEBINAR: "bg-cyan-500",
  CAREER_FAIR: "bg-emerald-500",
  PRE_PLACEMENT_TALK: "bg-indigo-500",
  ASSESSMENT: "bg-red-500",
  TRAINING: "bg-teal-500",
  ALUMNI_SESSION: "bg-orange-500",
  COMPANY_SESSION: "bg-lime-500",
  GENERAL: "bg-slate-500",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function EventCalendarView({ events }: { events: CalendarEvent[] }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.startAt);
      const key = dateKey(d);
      const existing = map.get(key);
      if (existing) existing.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startOffset; i++) result.push({ date: null });
    for (let day = 1; day <= daysInMonth; day++) result.push({ date: new Date(year, month, day) });
    while (result.length % 7 !== 0) result.push({ date: null });
    return result;
  }, [cursor]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="font-medium">{monthLabel}</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border text-xs">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-muted text-muted-foreground p-1.5 text-center font-medium">
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell.date) return <div key={i} className="bg-background min-h-20" />;
            const dayEvents = eventsByDay.get(dateKey(cell.date)) ?? [];
            const isToday = dateKey(cell.date) === dateKey(today);
            return (
              <button
                type="button"
                key={i}
                onClick={() => dayEvents.length > 0 && router.push(`/events/${dayEvents[0].id}`)}
                className="bg-background hover:bg-accent/40 flex min-h-20 flex-col items-stretch gap-1 p-1.5 text-left transition-colors"
                disabled={dayEvents.length === 0}
              >
                <span className={`text-[11px] ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {cell.date.getDate()}
                </span>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      title={`${e.title} — ${EVENT_CATEGORY_LABEL[e.category] ?? e.category}`}
                      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        router.push(`/events/${e.id}`);
                      }}
                    >
                      <span className={`size-1.5 shrink-0 rounded-full ${CATEGORY_DOT_CLASS[e.category] ?? "bg-slate-500"}`} />
                      <span className="truncate">{e.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-muted-foreground text-[10px]">+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {Object.entries(EVENT_CATEGORY_LABEL).map(([value, label]) => (
            <span key={value} className="flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${CATEGORY_DOT_CLASS[value] ?? "bg-slate-500"}`} /> {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
