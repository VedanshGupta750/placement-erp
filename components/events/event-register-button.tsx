"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Status = "CONFIRMED" | "PENDING" | "WAITLISTED" | "REJECTED" | "CANCELLED" | null;

const LABEL: Record<Exclude<Status, null>, string> = {
  CONFIRMED: "Registered — cancel",
  PENDING: "Pending approval — cancel",
  WAITLISTED: "Waitlisted — cancel",
  REJECTED: "Registration rejected",
  CANCELLED: "Register",
};

export function EventRegisterButton({ eventId, initialStatus }: { eventId: string; initialStatus: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, setPending] = useState(false);

  const isActive = status === "CONFIRMED" || status === "PENDING" || status === "WAITLISTED";

  async function toggle() {
    setPending(true);
    if (isActive) {
      const res = await fetch(`/api/events/${eventId}/register`, { method: "DELETE" });
      setPending(false);
      if (res.ok) {
        setStatus(null);
        toast.success("Registration cancelled");
        router.refresh();
      } else {
        toast.error("Something went wrong.");
      }
      return;
    }

    const res = await fetch(`/api/events/${eventId}/register`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus((data.status as Status) ?? "CONFIRMED");
      toast.success(data.status === "PENDING" ? "Registration submitted for approval" : data.status === "WAITLISTED" ? "Added to waitlist" : "Registered");
      router.refresh();
    } else {
      toast.error("Something went wrong.");
    }
  }

  return (
    <Button variant={isActive ? "outline" : "default"} disabled={pending} onClick={toggle}>
      {status ? LABEL[status] : "Register"}
    </Button>
  );
}
