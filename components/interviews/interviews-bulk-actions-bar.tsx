"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Bell, Ban, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { BulkScheduleDialog } from "@/components/interviews/bulk-schedule-dialog";

export function InterviewsBulkActionsBar({ candidateIds, onDone }: { candidateIds: string[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function run(action: string, label: string, extra?: Record<string, unknown>) {
    setPending(true);
    const res = await fetch("/api/round-candidates/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds, action, ...extra }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      const skippedNote = data.skipped ? ` (${data.skipped} skipped)` : "";
      toast.success(`${label}: ${data.successCount}${skippedNote}`);
      onDone();
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    toast.error(data.message ?? "Bulk action failed.");
    return false;
  }

  return (
    <div className="bg-accent/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <span className="text-sm font-medium">{candidateIds.length} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setScheduleOpen(true)}>
          <CalendarClock className="size-3.5" /> Schedule
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("remind", "Reminders sent")}>
          <Bell className="size-3.5" /> Send Reminder
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("mark_passed", "Marked passed")}>
          <CheckCircle2 className="size-3.5" /> Mark Passed
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("mark_failed", "Marked failed")}>
          <XCircle className="size-3.5" /> Mark Failed
        </Button>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>
            <Ban className="size-3.5" /> Cancel
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Cancel {candidateIds.length} interviews</DialogTitle></DialogHeader>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)" rows={2} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Back</DialogClose>
              <Button variant="destructive" disabled={pending} onClick={async () => { if (await run("cancel", "Cancelled", { reason: cancelReason })) { setCancelOpen(false); setCancelReason(""); } }}>
                {pending ? "Cancelling…" : "Cancel interviews"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" render={<a href={`/api/interviews/export?ids=${candidateIds.join(",")}`} />}>
          Export selected
        </Button>

        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>

      <BulkScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} candidateIds={candidateIds} onDone={onDone} />
    </div>
  );
}
