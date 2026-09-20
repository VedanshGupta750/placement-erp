"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightCircle, MessageSquare, MoreHorizontal, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const NEXT_STAGES: Record<string, { status: string; label: string }[]> = {
  APPLIED: [{ status: "COLLEGE_APPROVED", label: "Approve" }, { status: "REJECTED", label: "Reject" }],
  COLLEGE_APPROVED: [{ status: "SCREENING", label: "Move to Screening" }, { status: "SHORTLISTED", label: "Shortlist" }, { status: "REJECTED", label: "Reject" }],
  SCREENING: [{ status: "SHORTLISTED", label: "Shortlist" }, { status: "REJECTED", label: "Reject" }],
  SHORTLISTED: [{ status: "ROUND_IN_PROGRESS", label: "Move to Interview" }, { status: "SELECTED", label: "Mark Selected" }, { status: "REJECTED", label: "Reject" }],
  ROUND_IN_PROGRESS: [{ status: "SELECTED", label: "Mark Selected" }, { status: "REJECTED", label: "Reject" }],
};

export function ApplicationHeaderActions({
  applicationId,
  status,
  recipientUserId,
  canMoveStage,
  initialPriority,
  initialOwnerName,
}: {
  applicationId: string;
  status: string;
  recipientUserId: string;
  canMoveStage: boolean;
  initialPriority: string;
  initialOwnerName: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");

  async function moveStage(target: string, label: string) {
    setPending(true);
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move_stage", status: target }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(label);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't move this application.");
    }
  }

  async function setPriority(priority: string) {
    setPending(true);
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_priority", priority }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Priority updated.");
      router.refresh();
    } else {
      toast.error("Couldn't update priority.");
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
    if (res.ok) {
      setMsgOpen(false);
      setMsgBody("");
      toast.success("Message sent.");
    } else {
      toast.error("Couldn't send message.");
    }
  }

  const nextStages = NEXT_STAGES[status] ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canMoveStage && nextStages.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" disabled={pending} />}>
            <ArrowRightCircle className="size-3.5" /> Move Stage
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {nextStages.map((s) => (
              <DropdownMenuItem key={s.status} onClick={() => moveStage(s.status, s.label)} variant={s.status === "REJECTED" ? "destructive" : undefined}>
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="outline" size="sm" onClick={() => setMsgOpen(true)}>
        <MessageSquare className="size-3.5" /> Message
      </Button>
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

      {canMoveStage && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              Owner: {initialOwnerName ?? "Unassigned"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {["NORMAL", "HIGH", "URGENT"].map((p) => (
              <DropdownMenuItem key={p} disabled={p === initialPriority} onClick={() => setPriority(p)}>
                <Flag className="size-3.5" /> Set priority: {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
