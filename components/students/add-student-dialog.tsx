"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Course = { id: string; name: string; specialization: string | null };
type Batch = { id: string; year: number };
type Department = { id: string; name: string };

export function AddStudentDialog({ courses, batches, departments }: { courses: Course[]; batches: Batch[]; departments: Department[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        enrollmentNumber: fd.get("enrollmentNumber"),
        courseId,
        batchId,
        departmentId: departmentId || undefined,
        aggregate: fd.get("aggregate") ? Number(fd.get("aggregate")) : undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      setOpen(false);
      toast.success("Student added.");
      router.push(`/students/${data.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(Object.values(data.fieldErrors ?? {}).flat().join(" ") || "Couldn't add student.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus className="size-4" /> Add Student
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add a student</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enrollmentNumber">Enrollment No.</Label>
              <Input id="enrollmentNumber" name="enrollmentNumber" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aggregate">CGPA</Label>
              <Input id="aggregate" name="aggregate" type="number" step="0.01" min={0} max={10} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={(v) => v && setCourseId(v)}>
              <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.specialization ?? c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
                <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !courseId || !batchId}>{pending ? "Adding…" : "Add Student"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
