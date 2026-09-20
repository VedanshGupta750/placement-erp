import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  // Drive lifecycle
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REGISTRATION_OPEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REGISTRATION_CLOSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SELECTION_ONGOING: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  ARCHIVED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400",
  SUSPENDED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",

  // Application lifecycle
  REGISTERED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  APPLIED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  COLLEGE_APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  SCREENING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SHORTLISTED: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  ROUND_IN_PROGRESS: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  SELECTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  WITHDRAWN: "bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400",

  // Round candidate
  ASSIGNED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  CHECKED_IN: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  PASSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  NO_SHOW: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",

  // Offer lifecycle
  ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DECLINED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  JOINING_PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  JOINED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DID_NOT_JOIN: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",

  // Generic
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  INVITED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
};

function labelize(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn("border-none font-medium", TONE[status] ?? "bg-zinc-100 text-zinc-600", className)}>
      {labelize(status)}
    </Badge>
  );
}
