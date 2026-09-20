"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CONTACT_TYPES, RELATIONSHIP_STAGES, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

type ContactForEdit = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  contactType: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  linkedinUrl: string | null;
  relationshipStage: string;
  ownerId: string | null;
  isActive: boolean;
};

export function EditContactDialog({
  contact,
  users,
}: {
  contact: ContactForEdit;
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [contactType, setContactType] = useState(contact.contactType ?? "");
  const [relationshipStage, setRelationshipStage] = useState(contact.relationshipStage);
  const [ownerId, setOwnerId] = useState(contact.ownerId ?? "");
  const [isActive, setIsActive] = useState(contact.isActive);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name") || undefined,
        email: fd.get("email") || undefined,
        phone: fd.get("phone") || undefined,
        designation: fd.get("designation") || undefined,
        department: fd.get("department") || undefined,
        location: fd.get("location") || undefined,
        linkedinUrl: fd.get("linkedinUrl") || undefined,
        contactType: contactType || undefined,
        relationshipStage: relationshipStage || undefined,
        ownerId: ownerId || undefined,
        isActive,
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
      toast.success("Contact updated.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't update contact.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="size-3.5" /> Edit
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={contact.name ?? ""} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={contact.phone ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" defaultValue={contact.designation ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" defaultValue={contact.department ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={contact.location ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input id="linkedinUrl" name="linkedinUrl" defaultValue={contact.linkedinUrl ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Contact type</Label>
              <Select value={contactType || undefined} onValueChange={(v) => setContactType(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Relationship stage</Label>
              <Select value={relationshipStage} onValueChange={(v) => setRelationshipStage(v ?? relationshipStage)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => RELATIONSHIP_STAGE_LABELS[v as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{RELATIONSHIP_STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner</Label>
            <Select value={ownerId || undefined} onValueChange={(v) => setOwnerId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned">{(v: string) => users.find((u) => u.id === v)?.name ?? "Unassigned"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="group/field flex items-center gap-2">
            <Checkbox id="isActive" checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
            <Label htmlFor="isActive">Active contact</Label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
