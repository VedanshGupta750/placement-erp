"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkFollowUpCompleteButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const res = await fetch(`/api/contacts/${contactId}/follow-up/complete`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      router.refresh();
      toast.success("Follow-up marked completed.");
    } else {
      toast.error("Couldn't update follow-up.");
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={handleClick}>
      <CheckCircle2 className="size-3.5" /> {pending ? "Updating…" : "Mark Completed"}
    </Button>
  );
}
