"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type EditableOffer = {
  id: string;
  status: string;
  offerType: string;
  /** Decimal columns are serialised to strings by the server component. */
  totalCompensation: string;
  fixedCompensation: string | null;
  variableCompensation: string | null;
  stipend: string | null;
  joiningBonus: string | null;
  /** ISO date, or null. */
  joiningDate: string | null;
};

const TYPE_LABELS: Record<string, string> = { JOB: "Job", INTERNSHIP: "Internship", PPO: "PPO" };

const MONEY_FIELDS: { key: keyof EditableOffer; label: string; hint?: string }[] = [
  { key: "fixedCompensation", label: "Fixed (₹)" },
  { key: "variableCompensation", label: "Variable (₹)" },
  { key: "stipend", label: "Stipend (₹)", hint: "per month" },
  { key: "joiningBonus", label: "Joining bonus (₹)" },
];

// Edits a DRAFT offer. The endpoint (PATCH /api/offers/[id]/manage, action
// "edit") and its validator already existed but nothing ever called them —
// the figures were fixed at creation, so a typo in a package meant
// withdrawing the offer and making a new one.
//
// Draft only, matching the server: once an offer has been issued the student
// has seen those numbers, so changing them silently underneath would be
// wrong. The server returns 409 in that case and this only renders the
// trigger for a draft, so the two agree.
export function EditOfferDialog({ offer, studentName }: { offer: EditableOffer; studentName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [offerType, setOfferType] = useState(offer.offerType);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Only non-empty values go in the payload. The validator coerces with
    // z.coerce.number(), which turns "" into 0 — so sending every field
    // would silently rewrite a blank stipend to ₹0 rather than leaving it
    // alone.
    const payload: Record<string, unknown> = { action: "edit", offerType };
    for (const key of ["totalCompensation", "fixedCompensation", "variableCompensation", "stipend", "joiningBonus", "joiningDate"]) {
      const raw = String(fd.get(key) ?? "").trim();
      if (raw !== "") payload[key] = raw;
    }

    setPending(true);
    const res = await fetch(`/api/offers/${offer.id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      toast.error(data.message ?? fieldMessage ?? "Couldn't update this offer.");
      return;
    }
    setOpen(false);
    toast.success(`Offer for ${studentName} updated.`);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" /> Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit offer — {studentName}</DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Offer type</Label>
                <Select value={offerType} onValueChange={(v) => v && setOfferType(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => TYPE_LABELS[v] ?? "Select a type"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totalCompensation">Total compensation (₹) *</Label>
                <Input
                  id="totalCompensation"
                  name="totalCompensation"
                  type="number"
                  min={1}
                  step="1"
                  required
                  defaultValue={offer.totalCompensation}
                />
              </div>

              {MONEY_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    name={f.key}
                    type="number"
                    min={0}
                    step="1"
                    placeholder="—"
                    defaultValue={(offer[f.key] as string | null) ?? ""}
                  />
                  {f.hint && <p className="text-muted-foreground text-xs">{f.hint}</p>}
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="joiningDate">Joining date</Label>
                <Input
                  id="joiningDate"
                  name="joiningDate"
                  type="date"
                  defaultValue={offer.joiningDate ? offer.joiningDate.slice(0, 10) : ""}
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              Leaving a box empty keeps its current value rather than clearing it. Total compensation is what the
              roster and reports read.
            </p>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
