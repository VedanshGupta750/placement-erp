"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type DriveOption = { id: string; title: string; companyName: string | null };

export function LinkDriveDialog({
  conversationId,
  drives,
  isLinked,
}: {
  conversationId: string;
  drives: DriveOption[];
  isLinked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [driveId, setDriveId] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(nextDriveId: string | null) {
    setPending(true);
    const res = await fetch(`/api/messages/${conversationId}/link-drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driveId: nextDriveId }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setDriveId("");
      router.refresh();
      toast.success(nextDriveId ? "Drive linked." : "Drive unlinked.");
    } else {
      toast.error("Couldn't update the linked drive.");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <Link2 className="size-3.5" /> {isLinked ? "Change drive" : "Link a drive"}
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link a drive</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Drive</Label>
              <Select<string> value={driveId} onValueChange={(v) => setDriveId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a drive">
                    {(v: string) => drives.find((d) => d.id === v)?.title ?? "Pick a drive"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {drives.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title}
                      {d.companyName ? ` · ${d.companyName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {drives.length === 0 && <p className="text-muted-foreground text-xs">No drives available yet.</p>}
            </div>
            <div className="flex justify-end">
              <Button size="sm" disabled={!driveId || pending} onClick={() => submit(driveId)}>
                {pending ? "Linking…" : "Link drive"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLinked && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => submit(null)}
          aria-label="Unlink drive"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
