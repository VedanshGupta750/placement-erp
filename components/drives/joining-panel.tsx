"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

type Offer = { id: string; status: string; student: { user: { name: string } } };

// The offer.mark_joined API route (PATCH /api/drives/[id]/offers/[offerId])
// already existed and fully worked — it just had no UI trigger anywhere in
// the app until this tab. Only offers that have reached ACCEPTED/
// JOINING_PENDING are actionable here; everything earlier in the lifecycle
// stays in the Offers tab.
export function JoiningPanel({ driveId, offers, canMarkJoined }: { driveId: string; offers: Offer[]; canMarkJoined: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function markJoined(offerId: string, joined: boolean) {
    setPending(offerId);
    const res = await fetch(`/api/drives/${driveId}/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: joined ? "mark_joined" : "mark_did_not_join" }),
    });
    setPending(null);
    if (res.ok) {
      toast.success(joined ? "Marked as joined." : "Marked as did not join.");
      router.refresh();
    } else {
      toast.error("Couldn't update joining status.");
    }
  }

  const relevant = offers.filter((o) => ["ACCEPTED", "JOINING_PENDING", "JOINED", "DID_NOT_JOIN"].includes(o.status));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Joining ({relevant.length})</CardTitle></CardHeader>
      <CardContent className="flex flex-col divide-y">
        {relevant.map((o) => (
          <div key={o.id} className="flex items-center justify-between py-2.5">
            <div className="font-medium">{o.student.user.name}</div>
            <div className="flex items-center gap-2">
              <StatusBadge status={o.status} />
              {canMarkJoined && ["ACCEPTED", "JOINING_PENDING"].includes(o.status) && (
                <>
                  <Button size="sm" disabled={pending === o.id} onClick={() => markJoined(o.id, true)}>Mark joined</Button>
                  <Button size="sm" variant="outline" disabled={pending === o.id} onClick={() => markJoined(o.id, false)}>Did not join</Button>
                </>
              )}
            </div>
          </div>
        ))}
        {relevant.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No offers have reached the joining stage yet.</p>}
      </CardContent>
    </Card>
  );
}
