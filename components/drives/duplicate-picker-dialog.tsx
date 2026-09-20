"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

type PickerDrive = { id: string; title: string; companyName: string; isTemplate: boolean };

export function DuplicatePickerDialog({ open, onOpenChange, templatesOnly }: { open: boolean; onOpenChange: (v: boolean) => void; templatesOnly: boolean }) {
  const router = useRouter();
  const [drives, setDrives] = useState<PickerDrive[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/drives/picker${templatesOnly ? "?templates=1" : ""}`)
      .then((r) => r.json())
      .then((data) => setDrives(data.drives ?? []))
      .finally(() => setLoading(false));
  }, [open, templatesOnly]);

  async function confirm() {
    if (!selectedId) return;
    setPending(true);
    const res = await fetch(`/api/drives/${selectedId}/duplicate`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Drive created as a new draft.");
      onOpenChange(false);
      router.push(`/drives/${data.id}`);
    } else {
      toast.error("Couldn't create the drive.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{templatesOnly ? "Create from template" : "Duplicate an existing drive"}</DialogTitle>
        </DialogHeader>
        <Select value={selectedId} onValueChange={(v) => v && setSelectedId(v)}>
          <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : drives.length === 0 ? "No drives available" : "Select a drive"} /></SelectTrigger>
          <SelectContent>
            {drives.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.companyName} — {d.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {templatesOnly && drives.length === 0 && !loading && (
          <p className="text-muted-foreground text-xs">No drives are marked as templates yet — use &quot;Save as Template&quot; on any drive&apos;s actions menu to add one.</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending || !selectedId} onClick={confirm}>{pending ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
