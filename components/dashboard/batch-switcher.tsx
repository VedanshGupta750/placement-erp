"use client";

import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Batch = { id: string; year: number };

export function BatchSwitcher({ batches, activeBatchId }: { batches: Batch[]; activeBatchId: string | null }) {
  const router = useRouter();
  const labelsByValue = new Map<string, string>([
    ["all", "Batch: All"],
    ...batches.map((b) => [b.id, `Batch: ${b.year}`] as const),
  ]);

  async function handleChange(value: string | null) {
    await fetch("/api/batch-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: value === "all" ? null : value }),
    });
    router.refresh();
  }

  return (
    <Select value={activeBatchId ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="h-8 gap-1.5 text-xs">
        <CalendarRange className="text-muted-foreground size-3.5" />
        <SelectValue>{(value: string) => labelsByValue.get(value) ?? "Batch: All"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All batches</SelectItem>
        {batches.map((b) => (
          <SelectItem key={b.id} value={b.id}>Batch {b.year}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
