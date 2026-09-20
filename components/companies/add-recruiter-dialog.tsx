"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CONTACT_TYPES } from "@/lib/validators/contact";

// Company-scoped entry point into the Contact CRM: posts to the existing
// POST /api/contacts route with `companyId` fixed to this company (hidden,
// not user-editable) — this is not a rebuild of the full contact form.
export function AddRecruiterDialog({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [contactType, setContactType] = useState<string>("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: String(fd.get("email") ?? "") || undefined,
        phone: String(fd.get("phone") ?? "") || undefined,
        designation: String(fd.get("designation") ?? "") || undefined,
        contactType: contactType || undefined,
        companyId,
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setContactType("");
      form.reset();
      router.refresh();
      toast.success("Recruiter added.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error === "forbidden" ? "You don't have permission to add recruiters." : "Couldn't add recruiter.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" /> Add Recruiter
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add recruiter</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. Priya Sharma" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="name@company.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+91…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" placeholder="e.g. HR Manager" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Contact type</Label>
              <Select value={contactType} onValueChange={(v) => v && setContactType(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add recruiter"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
