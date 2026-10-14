"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { OffCampusPlacementDialog, type OffCampusValues } from "@/components/students/off-campus-placement-dialog";

export function OffCampusRowActions({
  studentId,
  studentName,
  placement,
  joined = false,
}: {
  studentId: string;
  studentName: string;
  placement: OffCampusValues;
  joined?: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  // "They actually started" is a separate fact from "I have seen the offer
  // letter", so joining is its own toggle rather than another status value.
  async function toggleJoined() {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/off-campus/${placement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joined: !joined }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Couldn't update the joining status.");
      return;
    }
    toast.success(joined ? "Marked as not joined." : "Marked as joined.");
    router.refresh();
  }

  async function remove() {
    const res = await fetch(`/api/students/${studentId}/off-campus/${placement.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't remove this placement.");
      return;
    }
    setDeleteOpen(false);
    toast.success("Placement removed.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={joined ? "Mark as not joined" : "Mark as joined"}
        title={joined ? "Joined — click to undo" : "Mark as joined"}
        onClick={toggleJoined}
      >
        {joined ? (
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="text-muted-foreground size-3.5" />
        )}
      </Button>
      <OffCampusPlacementDialog
        studentId={studentId}
        studentName={studentName}
        existing={placement}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Edit placement">
            <Pencil className="text-muted-foreground size-3.5" />
          </Button>
        }
      />
      <Button variant="ghost" size="icon-sm" aria-label="Remove placement" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="text-muted-foreground size-3.5" />
      </Button>
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemKind="placement"
        itemName={`${placement.companyName} (off-campus)`}
        consequences="The student may stop counting as placed, which changes the college placement rate. This can't be undone."
        onConfirm={remove}
      />
    </div>
  );
}
