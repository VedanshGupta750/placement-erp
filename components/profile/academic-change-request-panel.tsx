"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, PencilLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ACADEMIC_FIELD_LABELS, type AcademicRequestField } from "@/lib/validators/academic-request";

export type MyAcademicRequest = {
  id: string;
  field: string;
  currentValue: number | null;
  requestedValue: number;
  reason: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
};

const FIELDS: AcademicRequestField[] = ["AGGREGATE", "LIVE_BACKLOGS", "CLOSED_BACKLOGS"];

// Students can ask for an academic correction but never apply one — the
// request sits as PENDING until the placement cell approves it. That is
// why this is a request form and not an edit form.
export function AcademicChangeRequestPanel({ requests }: { requests: MyAcademicRequest[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [field, setField] = useState<AcademicRequestField>("AGGREGATE");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/profile/academic-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field,
        requestedValue: fd.get("requestedValue"),
        reason: fd.get("reason"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      setError(data.message ?? fieldMessage ?? "Couldn't send the request.");
      return;
    }
    toast.success("Request sent to the placement cell for approval.");
    setValue("");
    setOpen(false);
    router.refresh();
  }

  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Marks and backlogs are maintained by the placement cell. Request a correction and they&apos;ll review it.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <PencilLine className="size-3.5" /> Request a correction
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request an academic correction</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>What needs correcting?</Label>
                <div className="flex flex-wrap gap-2">
                  {FIELDS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setField(f);
                        setValue("");
                        setError(null);
                      }}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        field === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      {ACADEMIC_FIELD_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="requestedValue">Correct value</Label>
                <Input
                  id="requestedValue"
                  name="requestedValue"
                  type="number"
                  step={field === "AGGREGATE" ? "0.01" : "1"}
                  min={0}
                  max={field === "AGGREGATE" ? 10 : undefined}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  {field === "AGGREGATE" ? "Between 0 and 10." : "A whole number, 0 or more."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  required
                  placeholder="e.g. Semester 6 result declared on 12 Oct — CGPA revised after revaluation."
                />
                <p className="text-muted-foreground text-xs">
                  At least 10 characters. Mention the semester or document the placement cell can check against.
                </p>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button type="submit" disabled={pending} className="w-fit">
                {pending ? "Sending…" : "Send for approval"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pendingRequests.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {`${pendingRequests.length} ${pendingRequests.length === 1 ? "request is" : "requests are"} awaiting review.`}{" "}
          Your record won&apos;t change until the placement cell approves.
        </p>
      )}

      {requests.length > 0 && (
        <div className="max-h-56 divide-y overflow-y-auto rounded-md border [scrollbar-width:thin]">
          {requests.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{ACADEMIC_FIELD_LABELS[r.field as AcademicRequestField] ?? r.field}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.currentValue ?? "—"} → {r.requestedValue}
                  </span>
                  <StatusPill status={r.status} />
                </div>
                <p className="text-muted-foreground mt-0.5 break-words text-xs">{r.reason}</p>
                {r.reviewedByName && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Reviewed by {r.reviewedByName}
                    {r.reviewedAt ? ` on ${new Date(r.reviewedAt).toLocaleDateString("en-IN")}` : ""}
                    {r.reviewNote ? ` — ${r.reviewNote}` : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { className: string; icon: React.ElementType; label: string }> = {
    PENDING: { className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", icon: Clock, label: "Pending" },
    APPROVED: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", icon: CheckCircle2, label: "Approved" },
    REJECTED: { className: "bg-destructive/10 text-destructive", icon: XCircle, label: "Rejected" },
    SUPERSEDED: { className: "bg-muted text-muted-foreground", icon: XCircle, label: "Superseded" },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      <s.icon className="size-3" /> {s.label}
    </span>
  );
}
