"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CreateEventWizard, type ExistingEventForWizard } from "@/components/events/create-event-wizard";

type IdLabel = { id: string; label: string };

// Header action row for the Event 360 page — Edit (opens the wizard in edit
// mode, externally controlled via open/onOpenChange), Share (copies the
// event URL), and Cancel Event (sets cancelledAt via PATCH .../[id]).
export function EventHeaderActions({
  event,
  batches,
  departments,
  companies,
  drives,
  canEdit,
  canPublish,
  isCancelled,
}: {
  event: ExistingEventForWizard;
  batches: IdLabel[];
  departments: IdLabel[];
  companies: IdLabel[];
  drives: IdLabel[];
  canEdit: boolean;
  canPublish: boolean;
  isCancelled: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  async function share() {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Event link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function cancelEvent() {
    setCancelling(true);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: reason.trim() || undefined }),
    });
    setCancelling(false);
    if (res.ok) {
      setCancelOpen(false);
      toast.success("Event cancelled.");
      router.refresh();
    } else {
      toast.error("Couldn't cancel the event.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && !isCancelled && (
        <>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
          <CreateEventWizard
            batches={batches}
            departments={departments}
            companies={companies}
            drives={drives}
            existingEvent={event}
            open={editOpen}
            onOpenChange={setEditOpen}
            hideTrigger
          />
        </>
      )}

      <Button variant="outline" size="sm" onClick={share}>
        <Share2 className="size-3.5" /> Share
      </Button>

      {canPublish && !isCancelled && (
        <>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
            <XCircle className="size-3.5" /> Cancel Event
          </Button>
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Cancel this event?</DialogTitle>
              </DialogHeader>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional) — shown in the audit trail"
                rows={3}
              />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Back</DialogClose>
                <Button variant="destructive" disabled={cancelling} onClick={cancelEvent}>
                  {cancelling ? "Cancelling…" : "Cancel Event"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
