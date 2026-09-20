"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { COMPANY_SIZES, HIRING_TYPES } from "@/lib/validators/company";

type DuplicateMatch = { id: string; name: string };

export function AddCompanyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [size, setSize] = useState<string>("");
  const [hiringType, setHiringType] = useState<string>("");
  const lastPayload = useRef<Record<string, unknown> | null>(null);

  async function submit(payload: Record<string, unknown>, force: boolean) {
    setPending(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, force }),
    });
    setPending(false);

    if (res.ok) {
      const data = await res.json();
      toast.success("Company added.");
      setOpen(false);
      setDuplicate(null);
      router.push(`/companies/${data.id}`);
      return;
    }
    if (res.status === 409) {
      const data = await res.json();
      setDuplicate(data.match);
      return;
    }
    const data = await res.json().catch(() => ({}));
    toast.error(data.message ?? "Couldn't add the company.");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const recruiterName = String(fd.get("recruiterName") ?? "").trim();
    const payload: Record<string, unknown> = {
      name: fd.get("name"),
      website: fd.get("website") || undefined,
      industryType: fd.get("industryType") || undefined,
      headquarters: fd.get("headquarters") || undefined,
      linkedinUrl: fd.get("linkedinUrl") || undefined,
      about: fd.get("about") || undefined,
      size: size || undefined,
      hiringType: hiringType || undefined,
      recruiter: recruiterName
        ? {
            name: recruiterName,
            email: String(fd.get("recruiterEmail") ?? "") || undefined,
            phone: String(fd.get("recruiterPhone") ?? "") || undefined,
            designation: String(fd.get("recruiterDesignation") ?? "") || undefined,
          }
        : undefined,
    };
    lastPayload.current = payload;
    submit(payload, false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setDuplicate(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> Add Company
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add company</DialogTitle>
        </DialogHeader>

        {duplicate ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              A similar company already exists: <span className="font-medium">{duplicate.name}</span>.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  setDuplicate(null);
                  router.push(`/companies/${duplicate.id}`);
                }}
              >
                Use existing company
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={pending}
                onClick={() => lastPayload.current && submit(lastPayload.current, true)}
              >
                {pending ? "Creating…" : "Create anyway"}
              </Button>
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Company name *</Label>
              <Input id="name" name="name" required placeholder="e.g. Siemens" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="industryType">Industry</Label>
                <Input id="industryType" name="industryType" placeholder="e.g. Engineering" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Company size</Label>
                <Select value={size} onValueChange={(v) => v && setSize(v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s} employees</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="headquarters">Headquarters</Label>
                <Input id="headquarters" name="headquarters" placeholder="e.g. Bengaluru, India" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Hiring type</Label>
                <Select value={hiringType} onValueChange={(v) => v && setHiringType(v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {HIRING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" placeholder="https://…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="linkedinUrl">LinkedIn</Label>
                <Input id="linkedinUrl" name="linkedinUrl" placeholder="https://linkedin.com/company/…" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="about">Description</Label>
              <Textarea id="about" name="about" rows={2} placeholder="Short description…" />
            </div>

            <div className="mt-1 border-t pt-3">
              <p className="mb-2 text-sm font-medium">Primary recruiter (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recruiterName">Name</Label>
                  <Input id="recruiterName" name="recruiterName" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recruiterDesignation">Designation</Label>
                  <Input id="recruiterDesignation" name="recruiterDesignation" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recruiterEmail">Email</Label>
                  <Input id="recruiterEmail" name="recruiterEmail" type="email" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recruiterPhone">Phone</Label>
                  <Input id="recruiterPhone" name="recruiterPhone" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create company"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
