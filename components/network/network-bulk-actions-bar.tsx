"use client";

import { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

export function NetworkBulkActionsBar({ userIds, onDone }: { userIds: string[]; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");

  async function sendBulkMessage() {
    setPending(true);
    const res = await fetch("/api/network/bulk-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds, body: msgBody.trim() }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Sent to ${data.successCount} people.`);
      setMsgOpen(false);
      setMsgBody("");
      onDone();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't send messages.");
    }
  }

  // No "Send Announcement" bulk action here — the Broadcasts module only
  // supports predefined cohort audiences (all students / batch / department
  // / course / role), not an arbitrary custom user-ID list, so a deep-link
  // with a selected-people param would silently do nothing once it landed.
  const exportHref = `/api/network/export?ids=${userIds.join(",")}`;

  return (
    <div className="bg-accent/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <span className="text-sm font-medium">{userIds.length} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <MessageSquare className="size-3.5" /> Message
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Message {userIds.length} people</DialogTitle></DialogHeader>
            <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Write a message…" rows={3} />
            <p className="text-muted-foreground text-xs">Sent as a separate 1:1 message to each person, not a group chat.</p>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending || !msgBody.trim()} onClick={sendBulkMessage}>{pending ? "Sending…" : "Send"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" render={<a href={exportHref} />}>
          Export selected
        </Button>

        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
