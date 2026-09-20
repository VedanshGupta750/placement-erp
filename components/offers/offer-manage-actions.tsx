"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Ban, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export function OfferManageActions({
  offerId,
  driveId,
  status,
  canManage,
}: {
  offerId: string;
  driveId: string;
  status: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function issue() {
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue" }),
    });
    setPending(false);
    if (res.ok) { toast.success("Offer issued to student."); router.refresh(); } else toast.error("Couldn't issue offer.");
  }

  async function withdraw() {
    if (!confirm("Withdraw this offer? The student will no longer be able to respond to it.")) return;
    setPending(true);
    const res = await fetch(`/api/offers/${offerId}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
    setPending(false);
    if (res.ok) { toast.success("Offer withdrawn."); router.refresh(); } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't withdraw offer.");
    }
  }

  async function markJoined(joined: boolean) {
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: joined ? "mark_joined" : "mark_did_not_join" }),
    });
    setPending(false);
    if (res.ok) { toast.success(joined ? "Marked as joined." : "Marked as did not join."); router.refresh(); } else toast.error("Couldn't update joining status.");
  }

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" disabled={pending} onClick={issue}>
          <Send className="size-3.5" /> Issue to student
        </Button>
      )}
      {["ACCEPTED", "JOINING_PENDING"].includes(status) && (
        <>
          <Button size="sm" disabled={pending} onClick={() => markJoined(true)}>
            <CheckCircle2 className="size-3.5" /> Mark joined
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => markJoined(false)}>
            <XCircle className="size-3.5" /> Did not join
          </Button>
        </>
      )}
      {["DRAFT", "ISSUED"].includes(status) && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={withdraw}>
              <Ban className="size-3.5" /> Withdraw offer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
