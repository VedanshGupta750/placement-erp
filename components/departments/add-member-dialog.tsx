"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type StaffUser = { id: string; name: string; email: string };

const TITLE_OPTIONS = ["Head", "Coordinator", "Lead Coordinator", "Volunteer"];

export function AddMemberDialog({ departmentId, staff }: { departmentId: string; staff: StaffUser[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("Coordinator");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/departments/${departmentId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        designation: fd.get("designation"),
        title,
        isAdmin: fd.get("isAdmin") === "on",
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setUserId("");
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlus className="size-4" /> Add team member
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Staff member</Label>
            <Select value={userId} onValueChange={(v) => setUserId(v ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" placeholder="e.g. HOD, Mechanical" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={title} onValueChange={(v) => setTitle(v ?? "Coordinator")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isAdmin" />
            Grant admin access for this department
          </label>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !userId}>{pending ? "Adding…" : "Add member"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
