"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WithdrawButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleWithdraw() {
    if (!confirm("Withdraw this application? This can't be undone.")) return;
    setPending(true);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WITHDRAWN" }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Application withdrawn");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't withdraw this application.");
    }
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={handleWithdraw}>
      {pending ? "Withdrawing…" : "Withdraw"}
    </Button>
  );
}
