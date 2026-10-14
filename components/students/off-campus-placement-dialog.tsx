"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type OffCampusValues = {
  id: string;
  companyName: string;
  role: string | null;
  placementType: string;
  totalCompensation: string | null;
  stipend: string | null;
  durationMonths: number | null;
  location: string | null;
  offerDate: string | null;
  joiningDate: string | null;
  source: string | null;
  notes: string | null;
};

const TYPE_LABELS: Record<string, string> = { JOB: "Job", INTERNSHIP: "Internship" };

// Records a placement a student found themselves. The type picker is the
// point of the form: a job and an internship carry different figures, so the
// money fields swap rather than showing both and hoping the right one is
// filled — an annual CTC and a monthly stipend are not comparable numbers
// and mixing them silently corrupts the average package.
export function OffCampusPlacementDialog({
  studentId,
  studentName,
  existing,
  trigger,
}: {
  studentId: string;
  studentName: string;
  /** Present when editing; omitted when adding. */
  existing?: OffCampusValues;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [placementType, setPlacementType] = useState(existing?.placementType ?? "JOB");
  const isInternship = placementType === "INTERNSHIP";
  const editing = Boolean(existing);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "").trim();

    const payload: Record<string, unknown> = {
      companyName: text("companyName"),
      role: text("role"),
      placementType,
      location: text("location"),
      offerDate: text("offerDate"),
      joiningDate: text("joiningDate"),
      source: text("source"),
      notes: text("notes"),
      // Only the figures that belong to this type are sent, so switching a
      // record from job to internship doesn't leave a stale CTC behind.
      totalCompensation: isInternship ? "" : text("totalCompensation"),
      stipend: isInternship ? text("stipend") : "",
      durationMonths: isInternship ? text("durationMonths") : "",
    };

    setPending(true);
    const url = editing
      ? `/api/students/${studentId}/off-campus/${existing!.id}`
      : `/api/students/${studentId}/off-campus`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      toast.error(data.message ?? fieldMessage ?? "Couldn't save this placement.");
      return;
    }
    setOpen(false);
    toast.success(editing ? "Placement updated." : `Off-campus placement recorded for ${studentName}.`);
    router.refresh();
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus className="size-3.5" /> Add off-campus placement
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] sm:max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="size-4" />
              {editing ? "Edit off-campus placement" : `Off-campus placement — ${studentName}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>This is a *</Label>
              <Select value={placementType} onValueChange={(v) => v && setPlacementType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => TYPE_LABELS[v] ?? "Select"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JOB">Job</SelectItem>
                  <SelectItem value="INTERNSHIP">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="companyName">Company *</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  required
                  placeholder="e.g. Zoho"
                  defaultValue={existing?.companyName ?? ""}
                />
                <p className="text-muted-foreground text-xs">
                  Typed in, not picked from your companies list — a company the student found themselves usually
                  isn&apos;t a campus partner, and adding one here would skew the company reports.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role">Role</Label>
                <Input id="role" name="role" placeholder="e.g. Backend Engineer" defaultValue={existing?.role ?? ""} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="e.g. Pune" defaultValue={existing?.location ?? ""} />
              </div>

              {isInternship ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="stipend">Stipend (₹ / month)</Label>
                    <Input id="stipend" name="stipend" type="number" min={0} placeholder="—" defaultValue={existing?.stipend ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="durationMonths">Duration (months)</Label>
                    <Input id="durationMonths" name="durationMonths" type="number" min={1} max={60} placeholder="—" defaultValue={existing?.durationMonths ?? ""} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="totalCompensation">Annual CTC (₹)</Label>
                  <Input id="totalCompensation" name="totalCompensation" type="number" min={0} placeholder="—" defaultValue={existing?.totalCompensation ?? ""} />
                  <p className="text-muted-foreground text-xs">Counts towards the average and highest package.</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offerDate">Offer date</Label>
                <Input id="offerDate" name="offerDate" type="date" defaultValue={existing?.offerDate?.slice(0, 10) ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="joiningDate">Joining date</Label>
                <Input id="joiningDate" name="joiningDate" type="date" defaultValue={existing?.joiningDate?.slice(0, 10) ?? ""} />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="source">How they found it</Label>
                <Input id="source" name="source" placeholder="e.g. Referral, LinkedIn, company portal" defaultValue={existing?.source ?? ""} />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} placeholder="Anything worth recording" defaultValue={existing?.notes ?? ""} />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              Recording this marks the student as placed. It counts in the college placement rate and the Students
              roster, but not in any company or drive report — the college had no drive here.
            </p>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save changes" : "Record placement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
