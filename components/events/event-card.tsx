import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Mic2,
  Users2,
  Trophy,
  Code2,
  Video,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Users,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deriveEventStatus, EVENT_STATUS_LABEL, EVENT_STATUS_CLASSES, EVENT_CATEGORY_LABEL, type EventStatusInput } from "@/lib/events/status";

export type EventCardData = {
  id?: string;
  category: string;
  title: string;
  description: string;
  organizerLabel?: string | null;
  mode: string;
  venue?: string | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  registrationOpensAt?: string | Date | null;
  registrationClosesAt?: string | Date | null;
  publishedAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  speakerName?: string | null;
  registrationCount?: number;
};

const CATEGORY_ICON: Record<string, typeof Mic2> = {
  EXPERT_SESSION: Mic2,
  COMPETITION: Trophy,
  WORKSHOP: Code2,
  HACKATHON: Code2,
  WEBINAR: Video,
  CAREER_FAIR: Building2,
  PRE_PLACEMENT_TALK: Users2,
  ASSESSMENT: ClipboardCheck,
  TRAINING: GraduationCap,
  ALUMNI_SESSION: Users,
  COMPANY_SESSION: Briefcase,
  GENERAL: CalendarDays,
};

const CATEGORY_TILE_CLASSES: Record<string, string> = {
  EXPERT_SESSION: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  COMPETITION: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  WORKSHOP: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  HACKATHON: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  WEBINAR: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
  CAREER_FAIR: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  PRE_PLACEMENT_TALK: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  ASSESSMENT: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
  TRAINING: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  ALUMNI_SESSION: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  COMPANY_SESSION: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  GENERAL: "bg-muted text-muted-foreground",
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

// The single card shape used for the events list (a full-width row, not a
// grid tile — clicking one opens the Event 360 detail panel alongside the
// list rather than navigating away) and the wizard's live "student view
// preview", so what a TPO previews while building an event is exactly what
// students will see once published. `href` lets a caller point at either
// the split-panel selection (?selected=id) or a standalone full page.
export function EventCard({ event, href, selected }: { event: EventCardData; href?: string; selected?: boolean }) {
  const statusInput: EventStatusInput = {
    publishedAt: toDate(event.publishedAt),
    cancelledAt: toDate(event.cancelledAt),
    startAt: toDate(event.startAt),
    endAt: toDate(event.endAt),
    registrationOpensAt: toDate(event.registrationOpensAt),
    registrationClosesAt: toDate(event.registrationClosesAt),
  };
  const status = deriveEventStatus(statusInput);
  const startAt = toDate(event.startAt);
  const venueLabel = event.mode === "ONLINE" ? "Online" : event.venue || (event.mode === "HYBRID" ? "Hybrid" : "Venue TBA");
  const Icon = CATEGORY_ICON[event.category] ?? CalendarDays;
  const tileClasses = CATEGORY_TILE_CLASSES[event.category] ?? CATEGORY_TILE_CLASSES.GENERAL;

  const body = (
    <Card className={event.id ? `transition-colors hover:bg-accent/40 ${selected ? "ring-primary ring-2" : ""}` : undefined}>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tileClasses}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{EVENT_CATEGORY_LABEL[event.category] ?? event.category}</Badge>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${EVENT_STATUS_CLASSES[status]}`}>
              {EVENT_STATUS_LABEL[status]}
            </span>
          </div>
          <div className="mt-1 font-medium">{event.title || "Untitled event"}</div>
          <div className="text-muted-foreground line-clamp-2 text-sm">{event.description || "No description yet."}</div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {startAt && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" /> {startAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {startAt && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {startAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {venueLabel}
            </span>
            {event.speakerName && (
              <span className="flex items-center gap-1">
                <Mic2 className="size-3" /> {event.speakerName}
              </span>
            )}
          </div>
          {event.organizerLabel && <div className="text-muted-foreground mt-1 text-xs">Organized by {event.organizerLabel}</div>}
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center justify-between gap-2 pl-[3.25rem] text-left sm:w-auto sm:flex-col sm:items-end sm:pl-0 sm:text-right">
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users2 className="size-3" /> {event.registrationCount ?? 0} registered
          </span>
          {event.id && <span className="text-primary text-xs font-medium">View Event →</span>}
        </div>
      </CardContent>
    </Card>
  );

  if (!event.id) return body;
  return <Link href={href ?? `/events/${event.id}`}>{body}</Link>;
}
