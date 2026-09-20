"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Backlog = {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  semester: number | null;
  attempt: number;
  status: "ACTIVE" | "CLEARED";
};

export type SemesterResult = { semester: number; sgpa: number; credits: number | null };

export function AcademicDetailClient({
  studentId,
  backlogs,
  semesterResults,
  canEdit,
}: {
  studentId: string;
  backlogs: Backlog[];
  semesterResults: SemesterResult[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [addBacklogOpen, setAddBacklogOpen] = useState(false);
  const [addSemOpen, setAddSemOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const active = backlogs.filter((b) => b.status === "ACTIVE");
  const cleared = backlogs.filter((b) => b.status === "CLEARED");

  async function clearBacklog(id: string) {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/backlogs/${id}`, { method: "PATCH" });
    setPending(false);
    if (res.ok) {
      toast.success("Backlog marked cleared.");
      router.refresh();
    } else {
      toast.error("Couldn't update backlog.");
    }
  }

  async function addBacklog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/backlogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectName: fd.get("subjectName"),
        subjectCode: fd.get("subjectCode") || undefined,
        semester: fd.get("semester") ? Number(fd.get("semester")) : undefined,
        attempt: fd.get("attempt") ? Number(fd.get("attempt")) : undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setAddBacklogOpen(false);
      toast.success("Backlog added.");
      router.refresh();
    } else {
      toast.error("Couldn't add backlog.");
    }
  }

  async function addSemesterResult(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/semester-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        semester: Number(fd.get("semester")),
        sgpa: Number(fd.get("sgpa")),
        credits: fd.get("credits") ? Number(fd.get("credits")) : undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setAddSemOpen(false);
      toast.success("Semester result saved.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.fieldErrors ? Object.values(data.fieldErrors).flat().join(" ") : "Couldn't save.");
    }
  }

  const maxSgpa = Math.max(1, ...semesterResults.map((s) => s.sgpa));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Semester-wise SGPA</h3>
          {canEdit && (
            <Dialog open={addSemOpen} onOpenChange={setAddSemOpen}>
              <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
                <Plus className="size-3.5" /> Add semester result
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add semester result</DialogTitle></DialogHeader>
                <form onSubmit={addSemesterResult} className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="semester">Semester</Label>
                      <Input id="semester" name="semester" type="number" min={1} max={12} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sgpa">SGPA</Label>
                      <Input id="sgpa" name="sgpa" type="number" step="0.01" min={0} max={10} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="credits">Credits</Label>
                      <Input id="credits" name="credits" type="number" min={0} />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {semesterResults.length === 0 ? (
          <p className="text-muted-foreground text-sm">No semester results recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {semesterResults
              .slice()
              .sort((a, b) => a.semester - b.semester)
              .map((s) => (
                <div key={s.semester} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">Sem {s.semester}</span>
                  <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
                    <div
                      className="bg-primary flex h-full items-center justify-end rounded px-1.5 text-[10px] font-semibold text-primary-foreground"
                      style={{ width: `${Math.max(10, (s.sgpa / maxSgpa) * 100)}%` }}
                    >
                      {s.sgpa.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Active Backlogs ({active.length})</h3>
          {canEdit && (
            <Dialog open={addBacklogOpen} onOpenChange={setAddBacklogOpen}>
              <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
                <Plus className="size-3.5" /> Add backlog
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add backlog</DialogTitle></DialogHeader>
                <form onSubmit={addBacklog} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="subjectName">Subject</Label>
                    <Input id="subjectName" name="subjectName" required />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="subjectCode">Code</Label>
                      <Input id="subjectCode" name="subjectCode" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="semester2">Semester</Label>
                      <Input id="semester2" name="semester" type="number" min={1} max={12} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="attempt">Attempt</Label>
                      <Input id="attempt" name="attempt" type="number" min={1} defaultValue={1} />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                    <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {active.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active backlogs.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Attempt</TableHead>
                {canEdit && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.subjectName}{b.subjectCode ? ` (${b.subjectCode})` : ""}</TableCell>
                  <TableCell>{b.semester ?? "—"}</TableCell>
                  <TableCell>{b.attempt}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={() => clearBacklog(b.id)}>
                        <Check className="size-3" /> Mark cleared
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {cleared.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Historical Backlogs ({cleared.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {cleared.map((b) => (
              <Badge key={b.id} variant="outline" className="text-muted-foreground">
                {b.subjectName} — cleared
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
