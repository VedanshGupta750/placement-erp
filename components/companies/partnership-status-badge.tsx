import { Badge } from "@/components/ui/badge";
import { PARTNERSHIP_STATUS_LABELS } from "@/lib/validators/company";

const TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  PARTNER: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  DORMANT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  BLOCKED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

export function PartnershipStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={`border-none font-medium ${TONE[status] ?? TONE.PENDING} ${className ?? ""}`}>
      {PARTNERSHIP_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
