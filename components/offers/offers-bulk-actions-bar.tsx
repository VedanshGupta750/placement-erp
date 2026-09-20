"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function OffersBulkActionsBar({ offerIds, onDone }: { offerIds: string[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function bulkIssue() {
    setPending(true);
    const res = await fetch("/api/offers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerIds }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      const skippedNote = data.skipped ? ` (${data.skipped} skipped — not a draft)` : "";
      toast.success(`Issued ${data.successCount}${skippedNote}`);
      onDone();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Bulk issue failed.");
    }
  }

  return (
    <div className="bg-accent/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <span className="text-sm font-medium">{offerIds.length} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={bulkIssue}>
          <Send className="size-3.5" /> Issue to students
        </Button>
        <Button variant="outline" size="sm" render={<a href={`/api/offers/export?ids=${offerIds.join(",")}`} />}>
          Export selected
        </Button>
        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
