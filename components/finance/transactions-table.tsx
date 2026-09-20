"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Transaction = {
  id: string;
  type: "expense" | "revenue";
  label: string;
  description: string;
  amount: number;
  date: string;
  linkedTo: string | null;
  recordedBy: string;
};

export function TransactionsTable({ transactions, canManage }: { transactions: Transaction[]; canManage: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function remove(t: Transaction) {
    if (!confirm(`Delete this ${t.type}? This can't be undone.`)) return;
    setPendingId(t.id);
    const res = await fetch(`/api/finance/${t.type === "expense" ? "expenses" : "revenues"}/${t.id}`, { method: "DELETE" });
    setPendingId(null);
    if (res.ok) {
      toast.success("Deleted");
      router.refresh();
    } else {
      toast.error("Couldn't delete.");
    }
  }

  if (transactions.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">No expenses or revenue recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category / Source</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Linked to</TableHead>
            <TableHead>Recorded by</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={`${t.type}-${t.id}`}>
              <TableCell className="tabular-nums whitespace-nowrap">
                {new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </TableCell>
              <TableCell>
                <Badge variant={t.type === "revenue" ? "default" : "outline"} className={t.type === "revenue" ? "bg-emerald-600" : "text-rose-600"}>
                  {t.type === "revenue" ? "Revenue" : "Expense"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{t.label}</TableCell>
              <TableCell className="text-muted-foreground max-w-xs truncate">{t.description}</TableCell>
              <TableCell className="text-muted-foreground">{t.linkedTo ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{t.recordedBy}</TableCell>
              <TableCell className={`text-right tabular-nums font-medium ${t.type === "revenue" ? "text-emerald-600" : "text-rose-600"}`}>
                {t.type === "revenue" ? "+" : "-"}₹{t.amount.toLocaleString("en-IN")}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" disabled={pendingId === t.id} onClick={() => remove(t)}>
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
