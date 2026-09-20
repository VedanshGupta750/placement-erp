"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function OfferActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function respond(action: "accept" | "decline") {
    if (action === "decline" && !confirm("Decline this offer? This can't be undone.")) return;
    setPending(true);
    const res = await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(action === "accept" ? "Offer accepted" : "Offer declined");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't update this offer.");
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => respond("accept")}>
        Accept
      </Button>
      <Button size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={() => respond("decline")}>
        Decline
      </Button>
    </div>
  );
}
