"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

export function RecordBudgetItemDialog({ defaultFiscalYear, categories }: { defaultFiscalYear: string; categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/finance/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYear: fd.get("fiscalYear"),
        category: fd.get("category"),
        item: fd.get("item"),
        allottedAmount: fd.get("allottedAmount") || undefined,
        utilizedAmount: fd.get("utilizedAmount") || undefined,
        requestedAmount: fd.get("requestedAmount") || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setOpen(false);
      toast.success("Budget item added");
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't add budget item.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="size-3.5" /> Add budget item
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add a budget line item</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscalYear">Fiscal year</Label>
              <Input id="fiscalYear" name="fiscalYear" placeholder="2026-2027" defaultValue={defaultFiscalYear} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" placeholder="e.g. Placement Activities" list="budget-categories" required />
              <datalist id="budget-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item">Item</Label>
            <Input id="item" name="item" placeholder="e.g. CDPC Expenditure for Hospitality, travel and conduction of campus drives" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="allottedAmount">Allotted (₹)</Label>
              <Input id="allottedAmount" name="allottedAmount" type="number" min="0" step="1" placeholder="Prior year" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="utilizedAmount">Utilized (₹)</Label>
              <Input id="utilizedAmount" name="utilizedAmount" type="number" min="0" step="1" placeholder="Prior year" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="requestedAmount">Requested (₹)</Label>
              <Input id="requestedAmount" name="requestedAmount" type="number" min="0" step="1" placeholder="This year" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
