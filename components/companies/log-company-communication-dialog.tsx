"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

const TYPE_OPTIONS = [
  { value: "EMAIL_SENT", label: "Email sent" },
  { value: "EMAIL_RECEIVED", label: "Email received" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
] as const;

type CompanyContact = { id: string; name: string | null };

// Company-scoped version of components/contacts/log-communication-dialog.tsx:
// that one is built for a single fixed contactId, this one first lets the
// user pick WHICH of the company's recruiters the communication is with,
// then posts to the same existing POST /api/contacts/[id]/communications
// route using the selected contact's id in the URL.
export function LogCompanyCommunicationDialog({ contacts }: { contacts: CompanyContact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<string>("EMAIL_SENT");
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? "");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contactId) {
      toast.error("Pick a recruiter first.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    const occurredAt = fd.get("occurredAt");
    setPending(true);
    const res = await fetch(`/api/contacts/${contactId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        subject: fd.get("subject") || undefined,
        body: fd.get("body") || undefined,
        occurredAt: occurredAt ? new Date(String(occurredAt)).toISOString() : undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      form.reset();
      router.refresh();
      toast.success("Communication logged.");
    } else {
      toast.error("Couldn't log communication.");
    }
  }

  if (contacts.length === 0) {
    return (
      <Button size="sm" disabled title="Add a recruiter first">
        <Plus className="size-3.5" /> Log communication
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" /> Log communication
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log communication</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Recruiter</Label>
            <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => contacts.find((c) => c.id === v)?.name ?? "Select"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name ?? "Unnamed contact"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? type)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Details</Label>
            <Textarea id="body" name="body" rows={4} placeholder="What was discussed?" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="occurredAt">Occurred at</Label>
            <Input id="occurredAt" name="occurredAt" type="date" />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Log"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
