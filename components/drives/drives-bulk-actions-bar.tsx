"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send, Archive, UserCog, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type StaffMember = { id: string; name: string; email: string };

export function DrivesBulkActionsBar({ driveIds, onDone }: { driveIds: string[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  useEffect(() => {
    if (!ownerOpen || staff.length > 0) return;
    fetch("/api/drives/staff")
      .then((r) => r.json())
      .then((data) => setStaff(data.staff ?? []));
  }, [ownerOpen, staff.length]);

  async function run(action: string, label: string, payload?: Record<string, unknown>) {
    setPending(true);
    const res = await fetch("/api/drives/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driveIds, action, payload }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      const skippedNote = data.skipped ? ` (${data.skipped} skipped — not drafts)` : "";
      const recipientNote = data.recipientCount != null ? `, ${data.recipientCount} students notified` : "";
      toast.success(`${label}: ${data.successCount} drive${data.successCount === 1 ? "" : "s"}${recipientNote}${skippedNote}.`);
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
      <span className="text-sm font-medium">{driveIds.length} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("publish", "Published")}>
          <Send className="size-3.5" /> Publish
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("close", "Closed registration")}>
          Close registration
        </Button>

        <Dialog open={ownerOpen} onOpenChange={setOwnerOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <UserCog className="size-3.5" /> Assign Owner
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Assign an owner to {driveIds.length} drives</DialogTitle></DialogHeader>
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

        <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Megaphone className="size-3.5" /> Send Broadcast
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Notify applicants of {driveIds.length} drives</DialogTitle></DialogHeader>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            <Textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Message" rows={3} />
            <p className="text-muted-foreground text-xs">Sent to every student who has applied to any of the selected drives.</p>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={pending || !subject.trim() || !messageBody.trim()}
                onClick={async () => {
                  if (await run("broadcast", "Broadcast sent", { subject: subject.trim(), body: messageBody.trim() })) {
                    setBroadcastOpen(false);
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

        <Button variant="outline" size="sm" render={<a href={`/api/drives/export?ids=${driveIds.join(",")}`} />}>
          Export selected
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Archive ${driveIds.length} drives?`)) run("archive", "Archived");
          }}
        >
          <Archive className="size-3.5" /> Archive
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => {
            if (confirm(`Permanently delete ${driveIds.length} drives? Only drafts will actually be deleted — anything else is skipped.`)) run("delete", "Deleted");
          }}
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>

        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
