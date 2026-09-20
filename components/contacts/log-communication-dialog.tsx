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

export function LogCommunicationDialog({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<string>("EMAIL_SENT");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const occurredAt = fd.get("occurredAt");
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
      router.refresh();
      toast.success("Communication logged.");
    } else {
      toast.error("Couldn't log communication.");
    }
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
