// Event status is deliberately never a persisted, manually-transitioned enum
// (see the comment on the Event model in prisma/schema.prisma for why — no
// background job runner in this app means a persisted "LIVE" status would
// silently go stale). Instead it's derived fresh, every read, from a
// handful of timestamps. The only two real actions a TPO takes are Publish
// (sets publishedAt) and Cancel (sets cancelledAt).
export type EventStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED";

export type EventStatusInput = {
  publishedAt: Date | null;
  cancelledAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
};

const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export function deriveEventStatus(event: EventStatusInput, now: Date = new Date()): EventStatus {
  if (event.cancelledAt) return "CANCELLED";
  if (!event.publishedAt) return "DRAFT";

  const start = event.startAt;
  const end = event.endAt ?? (start ? new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS) : null);
  const regOpens = event.registrationOpensAt;
  const regCloses = event.registrationClosesAt ?? start;

  if (start && now >= start && (!end || now <= end)) return "LIVE";
  if (end && now > end) return "COMPLETED";
  if (regOpens && now < regOpens) return "SCHEDULED";
  if (regCloses && now >= regCloses) return "REGISTRATION_CLOSED";
  if (regOpens && now >= regOpens) return "REGISTRATION_OPEN";
  if (!start) return "SCHEDULED";
  return "SCHEDULED";
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  LIVE: "Live Now",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Tailwind classes for a subtle status pill — kept in one place so every
// surface (list cards, detail header, calendar) renders the same colors.
export const EVENT_STATUS_CLASSES: Record<EventStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  REGISTRATION_OPEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REGISTRATION_CLOSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  LIVE: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  COMPLETED: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  CANCELLED: "bg-red-100 text-red-700 line-through dark:bg-red-500/15 dark:text-red-400",
};

export const EVENT_CATEGORY_LABEL: Record<string, string> = {
  EXPERT_SESSION: "Expert Session",
  WORKSHOP: "Workshop",
  COMPETITION: "Competition",
  HACKATHON: "Hackathon",
  WEBINAR: "Webinar",
  CAREER_FAIR: "Career Fair",
  PRE_PLACEMENT_TALK: "Pre-Placement Talk",
  ASSESSMENT: "Assessment",
  TRAINING: "Training",
  ALUMNI_SESSION: "Alumni Session",
  COMPANY_SESSION: "Company Session",
  GENERAL: "Event",
};
