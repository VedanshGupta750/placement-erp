"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { InterviewerPicker } from "@/components/interviews/interviewer-picker";

export function BulkScheduleDialog({
  open,
  onOpenChange,
  candidateIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateIds: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState("ONLINE");
  const [scheduledAt, setScheduledAt] = useState("");
  const [venue, setVenue] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerId, setInterviewerId] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    const res = await fetch("/api/round-candidates/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds, action: "schedule", mode, scheduledAt: scheduledAt || undefined, venue: venue || undefined, meetingUrl: meetingUrl || undefined, interviewerName: interviewerName || undefined, interviewerId: interviewerId || undefined }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      const skippedNote = data.skipped ? ` (${data.skipped} skipped — already scheduled)` : "";
      toast.success(`Scheduled ${data.successCount} interviews${skippedNote}`);
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Bulk scheduling failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Schedule {candidateIds.length} interviews</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <Select value={mode} onValueChange={(v) => v && setMode(v)}>
            <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ONLINE">Online</SelectItem>
              <SelectItem value="OFFLINE">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          {mode === "OFFLINE" ? (
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" />
          ) : (
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="Meeting link" />
          )}
          <InterviewerPicker
            name={interviewerName}
            interviewerId={interviewerId}
            onChange={({ name, interviewerId }) => { setInterviewerName(name); setInterviewerId(interviewerId); }}
          />
          <p className="text-muted-foreground text-xs">Same date/time/mode is applied to all {candidateIds.length} candidates. Only candidates still awaiting scheduling are affected.</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending || !scheduledAt} onClick={submit}>{pending ? "Scheduling…" : "Schedule all"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
