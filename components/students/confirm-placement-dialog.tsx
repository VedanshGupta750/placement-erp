"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

// Confirming a placement is the moment a student stops being a candidate:
// it closes them out of further drives (subject to the college's cap) and
// moves the reported placement rate. So it is an explicit decision with a
// dialog, not a toggle someone can brush past.
export function ConfirmPlacementDialog({
  studentId,
  studentName,
  confirmed,
  evidence,
}: {
  studentId: string;
  studentName: string;
  confirmed: boolean;
  /** One-line summary of the offer or off-campus record, if any. */
  evidence?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(evidence ?? "");
  const [pending, setPending] = useState(false);

  async function submit(placed: boolean) {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/placement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placed, note: placed ? note : undefined }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Couldn't update the placement.");
      return;
    }
    setOpen(false);
    toast.success(placed ? `${studentName} marked as placed.` : "Placement confirmation withdrawn.");
    router.refresh();
  }

  return (
    <>
      <Button variant={confirmed ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
        {confirmed ? <Undo2 className="size-3.5" /> : <BadgeCheck className="size-3.5" />}
        {confirmed ? "Withdraw placement" : "Mark as placed"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmed ? "Withdraw this placement?" : `Mark ${studentName} as placed?`}</DialogTitle>
          </DialogHeader>

          {confirmed ? (
            <p className="text-muted-foreground text-sm">
              They will count as unplaced again, drop out of the placed figures, and be able to apply to drives
              without restriction. The student is notified.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">
                They will count towards your placement figures, and further drive applications will be limited by the
                cap your college has set under Settings. The student is notified.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="note">What is this placement? (optional)</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Accepted TCS offer, or off-campus Zoho"
                />
                <p className="text-muted-foreground text-xs">
                  Recorded in the audit trail, so a later question about why they were closed out has an answer.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button
              variant={confirmed ? "destructive" : "default"}
              disabled={pending}
              onClick={() => submit(!confirmed)}
            >
              {pending ? "Saving…" : confirmed ? "Withdraw" : "Mark as placed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
