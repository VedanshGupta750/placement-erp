"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ReopenDriveDialog } from "@/components/drives/reopen-drive-dialog";
import { toast } from "sonner";

export function DriveActions({ id, status, registrationClosesAt }: { id: string; status: string; registrationClosesAt: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(action: string, label: string) {
    setPending(true);
    const res = await fetch(`/api/drives/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(label);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error === "forbidden" ? "You don't have permission for this action." : "Something went wrong.");
    }
  }

  return (
    <div className="flex gap-2">
      {status === "DRAFT" && (
        <Button size="sm" disabled={pending} onClick={() => run("submit_approval", "Submitted for approval")}>
          Submit for approval
        </Button>
      )}
      {status === "PENDING_APPROVAL" && (
        <Button size="sm" disabled={pending} onClick={() => run("approve", "Drive approved")}>
          Approve
        </Button>
      )}
      {(status === "APPROVED" || status === "DRAFT") && (
        <Button size="sm" variant={status === "APPROVED" ? "default" : "outline"} disabled={pending} onClick={() => run("publish", "Drive published")}>
          Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("close", "Registrations closed")}>
          Close registrations
        </Button>
      )}
      {status === "REGISTRATION_CLOSED" && (
        <ReopenDriveDialog driveId={id} closedAt={registrationClosesAt} />
      )}
      {(status === "PUBLISHED" || status === "REGISTRATION_CLOSED" || status === "SELECTION_ONGOING") && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("complete", "Drive marked complete")}>
          Mark complete
        </Button>
      )}
      {!["SUSPENDED", "COMPLETED", "ARCHIVED", "CANCELLED"].includes(status) && (
        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run("suspend", "Drive suspended")}>
          Suspend
        </Button>
      )}
    </div>
  );
}
