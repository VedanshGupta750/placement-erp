"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CheckinPanel({
  eventId,
  isLive,
  checkInAt,
  checkOutAt,
  durationLabel,
}: {
  eventId: string;
  isLive: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationLabel: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function submit(action: "checkin" | "checkout") {
    setPending(true);
    const res = await fetch(`/api/events/${eventId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(action === "checkin" ? "Checked in!" : "Checked out!");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Something went wrong.");
    }
  }

  if (!checkInAt) {
    return (
      <Button disabled={!isLive || pending} onClick={() => submit("checkin")}>
        Check In
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <CheckCircle2 className="size-4 text-emerald-600" />
        Checked in at {new Date(checkInAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
      </div>

      {checkOutAt ? (
        <>
          <div className="text-muted-foreground text-sm">
            Checked out at {new Date(checkOutAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </div>
          {durationLabel && <div className="text-sm font-medium">Duration: {durationLabel}</div>}
        </>
      ) : (
        <Button disabled={pending} onClick={() => submit("checkout")}>
          Check Out
        </Button>
      )}
    </div>
  );
}
