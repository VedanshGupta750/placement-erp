"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ScheduleDialog } from "@/components/interviews/schedule-dialog";
import { EvaluateDialog } from "@/components/interviews/evaluate-dialog";
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
  studentId: string;
  applicationId: string;
  driveId: string;
  roundType: string;
};

export function InterviewRowActions({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [evaluateOpen, setEvaluateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function run(action: string, label: string, extra?: Record<string, unknown>) {
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setPending(false);
    if (res.ok) { toast.success(label); router.refresh(); } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't complete this action.");
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" render={<Link href={`/interviews/${candidate.id}`} />}>View</Button>

      {candidate.status === "ASSIGNED" && (
        <Button size="sm" disabled={pending} onClick={() => setScheduleOpen(true)}>Schedule</Button>
      )}
      {candidate.status === "SCHEDULED" && (
        <Button size="sm" disabled={pending} onClick={() => run("checkin", "Checked in")}>Check in</Button>
      )}
      {["SCHEDULED", "CHECKED_IN"].includes(candidate.status) && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("start", "Interview started")}>Start</Button>
      )}
      {candidate.status === "IN_PROGRESS" && (
        <Button size="sm" disabled={pending} onClick={() => run("end", "Interview ended")}>End</Button>
      )}
      {(candidate.status === "COMPLETED" || (candidate.status === "IN_PROGRESS")) && (
        <Button size="sm" disabled={pending} onClick={() => setEvaluateOpen(true)}>Evaluate</Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/students/${candidate.studentId}`} />}>View Student</DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/applications/${candidate.applicationId}`} />}>View Application</DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/drives/${candidate.driveId}`} />}>View Drive</DropdownMenuItem>
          <DropdownMenuSeparator />
          {["SCHEDULED", "CHECKED_IN"].includes(candidate.status) && (
            <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>Reschedule</DropdownMenuItem>
          )}
          {candidate.scheduledAt && (
            <DropdownMenuItem onClick={() => run("remind", "Reminder sent")}>Send Reminder</DropdownMenuItem>
          )}
          {["SCHEDULED", "CHECKED_IN"].includes(candidate.status) && (
            <DropdownMenuItem onClick={() => run("no_show", "Marked as no-show")}>Mark No-Show</DropdownMenuItem>
          )}
          {["ASSIGNED", "SCHEDULED", "CHECKED_IN"].includes(candidate.status) && (
            <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>Cancel</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} candidateId={candidate.id} action="schedule" initial={candidate} />
      <ScheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} candidateId={candidate.id} action="reschedule" initial={candidate} />
      <EvaluateDialog open={evaluateOpen} onOpenChange={setEvaluateOpen} candidateId={candidate.id} roundType={candidate.roundType} />
      <CancelInterviewDialog open={cancelOpen} onOpenChange={setCancelOpen} candidateId={candidate.id} />
    </div>
  );
}
