"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLinkIcon, CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ReviewRow = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  link: string;
  matchedKeywords: string[];
  firstSeenAt: string;
};

export function ReviewQueueTable({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function decideOne(id: string, action: "APPROVED" | "REJECTED") {
    setPendingIds((prev) => new Set(prev).add(id));
    const res = await fetch(`/api/external-jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (res.ok) {
      toast.success(action === "APPROVED" ? "Approved" : "Rejected");
      router.refresh();
    } else {
      toast.error("Couldn't update this posting.");
    }
  }

  function bulkDecide(action: "APPROVED" | "REJECTED") {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await fetch("/api/external-jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: [...selected], action }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${action === "APPROVED" ? "Approved" : "Rejected"} ${data.successCount}`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error("Bulk action failed.");
      }
    });
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">Nothing to review right now.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="bg-accent/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => bulkDecide("APPROVED")}>
              <CheckIcon className="size-3.5" /> Approve selected
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => bulkDecide("REJECTED")}>
              <XIcon className="size-3.5" /> Reject selected
            </Button>
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={selected.size === rows.length}
                onCheckedChange={(checked) => setSelected(checked === true ? new Set(rows.map((r) => r.id)) : new Set())}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Company & Role</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Matched on</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rowPending = pendingIds.has(row.id);
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox checked={selected.has(row.id)} onCheckedChange={(checked) => toggle(row.id, checked === true)} aria-label={`Select ${row.title}`} />
                </TableCell>
                <TableCell>
                  <a href={row.link} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                    {row.title} <ExternalLinkIcon className="inline size-3" />
                  </a>
                  <div className="text-muted-foreground text-xs">{row.company}</div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.location ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {row.matchedKeywords.map((kw) => (
                      <Badge key={kw} variant="outline" className="text-[10px]">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" disabled={rowPending} onClick={() => decideOne(row.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={rowPending} onClick={() => decideOne(row.id, "REJECTED")}>
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
