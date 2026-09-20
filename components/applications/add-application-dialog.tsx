"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type StudentHit = { id: string; name: string; enrollmentNumber: string };
type Drive = { id: string; title: string; companyName: string; positions: { id: string; title: string }[] };

export function AddApplicationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentHit | null>(null);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [driveId, setDriveId] = useState("");
  const [positionId, setPositionId] = useState("");

  useEffect(() => {
    if (!open || drives.length > 0) return;
    fetch("/api/drives/picker")
      .then((r) => r.json())
      .then((data) => setDrives(data.drives ?? []));
  }, [open, drives.length]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/students/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => setHits(data.students ?? []));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const selectedDrive = drives.find((d) => d.id === driveId);

  async function submit() {
    if (!selectedStudent || !driveId || !positionId) return;
    setPending(true);
    const res = await fetch("/api/applications/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selectedStudent.id, driveId, positionId }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Application added.");
      setOpen(false);
      router.push(`/applications/${data.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't add this application.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> Add Application
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add application</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Student</Label>
            {selectedStudent ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{selectedStudent.name} ({selectedStudent.enrollmentNumber})</span>
                <button type="button" className="text-muted-foreground hover:text-foreground text-xs" onClick={() => setSelectedStudent(null)}>Change</button>
              </div>
            ) : (
              <>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or enrollment number…" />
                {hits.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border">
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className="hover:bg-accent flex w-full items-center justify-between px-3 py-1.5 text-left text-sm"
                        onClick={() => { setSelectedStudent(h); setQuery(""); setHits([]); }}
                      >
                        <span>{h.name}</span>
                        <span className="text-muted-foreground text-xs">{h.enrollmentNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Drive</Label>
            <Select value={driveId} onValueChange={(v) => { if (v) { setDriveId(v); setPositionId(""); } }}>
              <SelectTrigger><SelectValue placeholder="Select a drive" /></SelectTrigger>
              <SelectContent>
                {drives.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.companyName} — {d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedDrive && (
            <div className="flex flex-col gap-1.5">
              <Label>Position</Label>
              <Select value={positionId} onValueChange={(v) => v && setPositionId(v)}>
                <SelectTrigger><SelectValue placeholder="Select a position" /></SelectTrigger>
                <SelectContent>
                  {selectedDrive.positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-muted-foreground text-xs">Eligibility isn&apos;t re-checked — this is a manual TPO override, same as "Add to Drive" elsewhere in this app.</p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending || !selectedStudent || !driveId || !positionId} onClick={submit}>{pending ? "Adding…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
