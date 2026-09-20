"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { InterviewerPicker } from "@/components/interviews/interviewer-picker";

// Shared by the table row action and the Interview Detail page — schedule
// AND reschedule both go through this, differing only in the `action` sent
// and the button label. Runs the real conflict check from
// lib/interviews/conflicts.ts before committing; a conflict pauses for
// confirmation rather than silently double-booking a slot, same pattern as
// the Drives eligibility-republish confirmation flow.
export function ScheduleDialog({
  open,
  onOpenChange,
  candidateId,
  action,
  initial,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  action: "schedule" | "reschedule";
  initial?: { scheduledAt?: string | null; mode?: string; venue?: string | null; meetingUrl?: string | null; interviewerName?: string | null; interviewerId?: string | null };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState(initial?.mode ?? "ONLINE");
  const [date, setDate] = useState(initial?.scheduledAt ? new Date(initial.scheduledAt).toISOString().slice(0, 16) : "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [meetingUrl, setMeetingUrl] = useState(initial?.meetingUrl ?? "");
  const [interviewerName, setInterviewerName] = useState(initial?.interviewerName ?? "");
  const [interviewerId, setInterviewerId] = useState<string | null>(initial?.interviewerId ?? null);

  async function submit(confirmed = false) {
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, mode, scheduledAt: date || undefined, venue: mode === "OFFLINE" ? venue : undefined, meetingUrl: mode === "ONLINE" ? meetingUrl : undefined, interviewerName: interviewerName || undefined, interviewerId: interviewerId || undefined, confirmed }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (res.ok && data.needsConfirmation) {
      const ok = confirm(`${data.conflicts.map((c: { message: string }) => c.message).join("\n")}\n\nSchedule anyway?`);
      if (ok) await submit(true);
      return;
    }
    if (res.ok) {
      toast.success(action === "schedule" ? "Interview scheduled." : "Interview rescheduled.");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't save schedule.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{action === "schedule" ? "Schedule interview" : "Reschedule interview"}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Date &amp; time</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => v && setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ONLINE">Online</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "ONLINE" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Meeting link</Label>
              <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/…" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Venue</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Room / building" />
            </div>
          )}
          <InterviewerPicker
            name={interviewerName}
            interviewerId={interviewerId}
            onChange={({ name, interviewerId }) => { setInterviewerName(name); setInterviewerId(interviewerId); }}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending || !date} onClick={() => submit(false)}>{pending ? "Saving…" : action === "schedule" ? "Schedule" : "Reschedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
