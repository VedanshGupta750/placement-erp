"use client";

import { useState, type FormEvent, type ReactNode, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

export function SetFollowUpDialog({
  contactId,
  initialDate,
  initialNote,
  triggerLabel = (
    <>
      <Calendar className="size-3.5" /> Follow-up
    </>
  ),
  triggerVariant = "outline",
  triggerSize = "sm",
}: {
  contactId: string;
  initialDate?: string | null;
  initialNote?: string | null;
  triggerLabel?: ReactNode;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/contacts/${contactId}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nextFollowUpAt: fd.get("nextFollowUpAt") ? new Date(String(fd.get("nextFollowUpAt"))).toISOString() : "",
        nextFollowUpNote: fd.get("nextFollowUpNote") || undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      toast.success("Follow-up scheduled.");
    } else {
      toast.error("Couldn't set follow-up.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nextFollowUpAt">Follow-up date</Label>
            <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={initialDate ?? ""} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nextFollowUpNote">Note</Label>
            <Textarea id="nextFollowUpNote" name="nextFollowUpNote" rows={3} placeholder="Optional" defaultValue={initialNote ?? ""} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
