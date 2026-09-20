"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, MoreHorizontal, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScheduleDialog } from "@/components/interviews/schedule-dialog";
import { CancelInterviewDialog } from "@/components/interviews/cancel-interview-dialog";

type Candidate = {
  id: string;
  status: string;
  scheduledAt: string | null;
  mode: string;
  venue: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
  interviewerId: string | null;
};

export function InterviewDetailActions({
  candidate,
  recipientUserId,
  canManage,
  nextRound,
}: {
  candidate: Candidate;
  recipientUserId: string;
  canManage: boolean;
  nextRound: { applicationId: string; roundId: string; roundName: string } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");

  async function run(action: string, label: string) {
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (res.ok) { toast.success(label); router.refresh(); } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't complete this action.");
    }
  }

  async function sendMessage() {
    if (!msgBody.trim()) return;
    setPending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUserId, body: msgBody.trim() }),
    });
    setPending(false);
    if (res.ok) { setMsgOpen(false); setMsgBody(""); toast.success("Message sent."); } else toast.error("Couldn't send message.");
  }

  async function scheduleNextRound() {
    if (!nextRound) return;
    setPending(true);
    const res = await fetch("/api/round-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: nextRound.applicationId, roundId: nextRound.roundId }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(`Assigned to ${nextRound.roundName}.`);
      router.push("/interviews");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't assign next round.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && nextRound && candidate.status === "PASSED" && (
        <Button size="sm" disabled={pending} onClick={scheduleNextRound}>
          <CalendarClock className="size-3.5" /> Schedule {nextRound.roundName}
        </Button>
      )}
      {canManage && candidate.status === "ASSIGNED" && (
        <Button size="sm" disabled={pending} onClick={() => setScheduleOpen(true)}>Schedule Interview</Button>
      )}
      {canManage && ["SCHEDULED", "CHECKED_IN"].includes(candidate.status) && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setRescheduleOpen(true)}>Reschedule</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("start", "Interview started")}>Start Interview</Button>
        </>
      )}
      {canManage && candidate.status === "IN_PROGRESS" && (
        <Button size="sm" disabled={pending} onClick={() => run("end", "Interview ended")}>End Interview</Button>
      )}

      <Button variant="outline" size="sm" onClick={() => setMsgOpen(true)}>
        <MessageSquare className="size-3.5" /> Message
      </Button>

      {canManage && ["ASSIGNED", "SCHEDULED", "CHECKED_IN"].includes(candidate.status) && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>Cancel interview</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Message student</DialogTitle></DialogHeader>
          <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Type your message…" rows={4} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button disabled={pending || !msgBody.trim()} onClick={sendMessage}>{pending ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} candidateId={candidate.id} action="schedule" initial={candidate} />
      <ScheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} candidateId={candidate.id} action="reschedule" initial={candidate} />
      <CancelInterviewDialog open={cancelOpen} onOpenChange={setCancelOpen} candidateId={candidate.id} />
    </div>
  );
}
