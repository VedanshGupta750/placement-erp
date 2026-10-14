"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// An off-campus placement does not make a student placed on its own — a
// staff member decides (see lib/students/placement.ts). This puts that
// decision where the evidence is, so a TPO working down the Job Offers list
// doesn't have to open each profile to act on what they are already reading.
export function MarkPlacedButton({
  studentId,
  studentName,
  companyName,
}: {
  studentId: string;
  studentName: string;
  companyName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function markPlaced() {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/placement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placed: true, note: `Off-campus — ${companyName}` }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.status === 403 ? "You don't have permission to confirm placements." : "Couldn't mark as placed.");
      return;
    }
    toast.success(`${studentName} marked as placed.`);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={pending} onClick={markPlaced}>
      <BadgeCheck className="size-3" /> {pending ? "Saving…" : "Mark placed"}
    </Button>
  );
}
