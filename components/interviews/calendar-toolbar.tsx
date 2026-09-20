import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CalendarToolbar({
  view,
  label,
  prevHref,
  nextHref,
  todayHref,
}: {
  view: "day" | "week" | "month";
  label: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" render={<Link href={prevHref} aria-label="Previous" />}><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" size="sm" render={<Link href={todayHref} />}>Today</Button>
        <Button variant="outline" size="icon" render={<Link href={nextHref} aria-label="Next" />}><ChevronRight className="size-4" /></Button>
        <span className="ml-2 text-sm font-medium">{label}</span>
      </div>
      <div className="flex gap-1 rounded-lg border p-1">
        {(["day", "week", "month"] as const).map((v) => (
          <Link
            key={v}
            href={`?view=${v}`}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {v}
          </Link>
        ))}
      </div>
    </div>
  );
}
