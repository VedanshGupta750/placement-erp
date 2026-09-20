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
import { CONTACT_TYPES, RELATIONSHIP_STAGES, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

type Company = { id: string; name: string };
type StaffUser = { id: string; name: string };

export function CreateContactDialog({ companies, users }: { companies: Company[]; users: StaffUser[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [contactType, setContactType] = useState("");
  const [relationshipStage, setRelationshipStage] = useState<string>("NEW");
  const [ownerId, setOwnerId] = useState("");

  function reset() {
    setCompanyId("");
    setContactType("");
    setRelationshipStage("NEW");
    setOwnerId("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email") || undefined,
        phone: fd.get("phone") || undefined,
        contactType: contactType || undefined,
        companyId: companyId || undefined,
        designation: fd.get("designation") || undefined,
        relationshipStage: relationshipStage || undefined,
        ownerId: ownerId || undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      reset();
      toast.success("Contact added");
      router.refresh();
    } else {
      toast.error("Couldn't add contact.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> New contact
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add recruiter contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Contact type</Label>
              <Select value={contactType} onValueChange={(v) => setContactType(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Organisation</Label>
              <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unaffiliated">{(v: string) => companies.find((c) => c.id === v)?.name ?? "Unaffiliated"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" placeholder="e.g. Senior HR Manager" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Relationship stage</Label>
              <Select value={relationshipStage} onValueChange={(v) => setRelationshipStage(v ?? "NEW")}>
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
            <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? "")}>
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
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add contact"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
