"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, MessageSquare, Plus, MoreHorizontal, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { COMPANY_SIZES, HIRING_TYPES, PARTNERSHIP_STATUS_LABELS } from "@/lib/validators/company";

type Initial = {
  legalName: string | null;
  website: string | null;
  industryType: string | null;
  headquarters: string | null;
  linkedinUrl: string | null;
  about: string | null;
  size: string | null;
  hiringType: string | null;
};

export function CompanyHeaderActions({
  companyId,
  companyName,
  status,
  primaryContactId,
  canEdit,
  initial,
}: {
  companyId: string;
  companyName: string;
  status: string;
  primaryContactId: string | null;
  canEdit: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [size, setSize] = useState(initial.size ?? "");
  const [hiringType, setHiringType] = useState(initial.hiringType ?? "");

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await fetch(`/api/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: fd.get("legalName") || undefined,
        website: fd.get("website") || undefined,
        industryType: fd.get("industryType") || undefined,
        headquarters: fd.get("headquarters") || undefined,
        linkedinUrl: fd.get("linkedinUrl") || undefined,
        about: fd.get("about") || undefined,
        size: size || undefined,
        hiringType: hiringType || undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setEditOpen(false);
      toast.success("Company updated.");
      router.refresh();
    } else {
      toast.error("Couldn't update the company.");
    }
  }

  async function changeStatus(next: string) {
    setPending(true);
    const res = await fetch(`/api/companies/${companyId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Partnership status updated.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't update the status.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Company link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" render={<Link href={`/drives/new?companyName=${encodeURIComponent(companyName)}`} />}>
        <Plus className="size-3.5" /> Create Drive
      </Button>

      {primaryContactId && (
        <Button variant="outline" size="sm" render={<Link href={`/messages/contact/${primaryContactId}`} />}>
          <MessageSquare className="size-3.5" /> Message Recruiter
        </Button>
      )}

      {canEdit && (
        <>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Edit company details</DialogTitle></DialogHeader>
              <form className="flex flex-col gap-3" onSubmit={saveEdit}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="legalName">Legal name</Label>
                    <Input id="legalName" name="legalName" defaultValue={initial.legalName ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="industryType">Industry</Label>
                    <Input id="industryType" name="industryType" defaultValue={initial.industryType ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="headquarters">Headquarters</Label>
                    <Input id="headquarters" name="headquarters" defaultValue={initial.headquarters ?? ""} />
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
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" name="website" defaultValue={initial.website ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="linkedinUrl">LinkedIn</Label>
                    <Input id="linkedinUrl" name="linkedinUrl" defaultValue={initial.linkedinUrl ?? ""} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
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
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="about">Description</Label>
                  <Textarea id="about" name="about" rows={3} defaultValue={initial.about ?? ""} />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                  <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="size-3.5" /> Copy company link
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              {Object.entries(PARTNERSHIP_STATUS_LABELS).map(([value, label]) => (
                <DropdownMenuItem key={value} disabled={pending || value === status} onClick={() => changeStatus(value)} variant={value === "BLOCKED" ? "destructive" : undefined}>
                  Mark as {label}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
