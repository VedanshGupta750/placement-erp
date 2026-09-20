"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BudgetCategorySummary } from "@/lib/budget/get-budget-summary";

function fmtINR(n: number | null) {
  if (n === null) return "—";
  return `₹${(n / 100000).toFixed(2)}L`;
}

export function BudgetTable({
  categories,
  allottedGrandTotal,
  utilizedGrandTotal,
  requestedGrandTotal,
  canManage,
}: {
  categories: BudgetCategorySummary[];
  allottedGrandTotal: number;
  utilizedGrandTotal: number;
  requestedGrandTotal: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function saveUtilized(id: string, value: string) {
    setPendingId(id);
    const res = await fetch(`/api/finance/budget/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utilizedAmount: value === "" ? null : value }),
    });
    setPendingId(null);
    setEditingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error("Couldn't update utilized amount.");
    }
  }

  async function deleteItem(id: string) {
    setPendingId(id);
    const res = await fetch(`/api/finance/budget/${id}`, { method: "DELETE" });
    setPendingId(null);
    if (res.ok) {
      toast.success("Budget item removed");
      router.refresh();
    } else {
      toast.error("Couldn't remove item.");
    }
  }

  if (categories.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">No budget data for this year yet — add the first line item.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Allotted (prior yr)</TableHead>
            <TableHead className="text-right">Utilized (prior yr)</TableHead>
            <TableHead>% Used</TableHead>
            <TableHead className="text-right">Requested (this yr)</TableHead>
            {canManage && <TableHead className="w-8"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => (
            <Fragment key={cat.category}>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={canManage ? 6 : 5} className="font-semibold">{cat.category}</TableCell>
              </TableRow>
              {cat.items.map((item) => {
                const pct = item.allottedAmount && item.allottedAmount > 0 && item.utilizedAmount != null ? Math.round((item.utilizedAmount / item.allottedAmount) * 1000) / 10 : null;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-md">{item.item}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtINR(item.allottedAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {canManage && editingId === item.id ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          defaultValue={item.utilizedAmount ?? ""}
                          disabled={pendingId === item.id}
                          onBlur={(e) => saveUtilized(item.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="border-input w-28 rounded-md border bg-transparent px-2 py-1 text-right text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => canManage && setEditingId(item.id)}
                          className={canManage ? "hover:underline" : undefined}
                        >
                          {fmtINR(item.utilizedAmount)}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="w-32">
                      {pct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", pct > 100 ? "bg-destructive" : "bg-primary")}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground w-10 shrink-0 text-xs tabular-nums">{pct}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtINR(item.requestedAmount)}</TableCell>
                    {canManage && (
                      <TableCell>
                        <button type="button" onClick={() => deleteItem(item.id)} disabled={pendingId === item.id} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              <TableRow className="font-medium">
                <TableCell>Total — {cat.category}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtINR(cat.allottedTotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtINR(cat.utilizedTotal)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right tabular-nums">{fmtINR(cat.requestedTotal)}</TableCell>
                {canManage && <TableCell></TableCell>}
              </TableRow>
            </Fragment>
          ))}
          <TableRow className="border-t-2 font-semibold">
            <TableCell>Grand Total</TableCell>
            <TableCell className="text-right tabular-nums">{fmtINR(allottedGrandTotal)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtINR(utilizedGrandTotal)}</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right tabular-nums">{fmtINR(requestedGrandTotal)}</TableCell>
            {canManage && <TableCell></TableCell>}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
