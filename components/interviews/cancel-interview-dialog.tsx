"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

export function CancelInterviewDialog({
  open,
  onOpenChange,
  candidateId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");

  async function submit() {
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: reason || undefined }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Interview cancelled.");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't cancel interview.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cancel interview</DialogTitle></DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" rows={3} />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Back</DialogClose>
          <Button variant="destructive" disabled={pending} onClick={submit}>{pending ? "Cancelling…" : "Cancel interview"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
