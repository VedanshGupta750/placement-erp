"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, XCircle, UserCog, MessageSquare, Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type StaffMember = { id: string; name: string; email: string };

export function ApplicationsBulkActionsBar({ applicationIds, onDone }: { applicationIds: string[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!ownerOpen || staff.length > 0) return;
    fetch("/api/drives/staff")
      .then((r) => r.json())
      .then((data) => setStaff(data.staff ?? []));
  }, [ownerOpen, staff.length]);

  async function run(action: string, label: string, payload?: Record<string, unknown>) {
    setPending(true);
    const res = await fetch("/api/applications/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationIds, action, payload }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      const skippedNote = data.skipped ? ` (${data.skipped} skipped — not a valid transition)` : "";
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
      <span className="text-sm font-medium">{applicationIds.length} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("shortlist", "Shortlisted")}>
          <CheckCircle2 className="size-3.5" /> Shortlist
        </Button>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <XCircle className="size-3.5" /> Reject
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Reject {applicationIds.length} applications</DialogTitle></DialogHeader>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason (optional)" rows={2} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={pending}
                variant="destructive"
                onClick={async () => { if (await run("reject", "Rejected", { reason: rejectReason })) { setRejectOpen(false); setRejectReason(""); } }}
              >
                {pending ? "Rejecting…" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={ownerOpen} onOpenChange={setOwnerOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <UserCog className="size-3.5" /> Assign Owner
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Assign an owner to {applicationIds.length} applications</DialogTitle></DialogHeader>
            <Select value={ownerId} onValueChange={(v) => v && setOwnerId(v)}>
              <SelectTrigger><SelectValue placeholder={staff.length === 0 ? "Loading…" : "Select a staff member"} /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending || !ownerId} onClick={async () => { if (await run("assign_owner", "Owner assigned", { ownerId })) { setOwnerOpen(false); setOwnerId(""); } }}>
                {pending ? "Assigning…" : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <MessageSquare className="size-3.5" /> Send Message
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Notify {applicationIds.length} students</DialogTitle></DialogHeader>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            <Textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Message" rows={3} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={pending || !subject.trim() || !messageBody.trim()}
                onClick={async () => {
                  if (await run("send_message", "Message sent", { subject: subject.trim(), body: messageBody.trim() })) {
                    setMessageOpen(false);
                    setSubject("");
                    setMessageBody("");
                  }
                }}
              >
                {pending ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Select onValueChange={(v) => v && run("set_priority", "Priority updated", { priority: v })}>
          <SelectTrigger className="h-8 w-32"><Flag className="size-3.5" /><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" render={<a href={`/api/applications/export?ids=${applicationIds.join(",")}`} />}>
          Export selected
        </Button>

        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
