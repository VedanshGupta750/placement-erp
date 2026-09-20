"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { REVENUE_SOURCES } from "@/lib/validators/finance";

type Option = { id: string; title: string };
type CompanyOption = { id: string; name: string };

export function RecordRevenueDialog({ drives, events, companies }: { drives: Option[]; events: Option[]; companies: CompanyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<string>("");
  const [driveId, setDriveId] = useState<string>("");
  const [eventId, setEventId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!source) {
      toast.error("Pick a source.");
      return;
    }
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/finance/revenues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        description: fd.get("description"),
        amount: fd.get("amount"),
        receivedDate: fd.get("receivedDate"),
        companyId: companyId || undefined,
        driveId: driveId || undefined,
        eventId: eventId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setSource("");
      setDriveId("");
      setEventId("");
      setCompanyId("");
      toast.success("Revenue recorded");
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't record revenue.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-3.5" /> Record revenue
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Record revenue</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => v && setSource(v)}>
                <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {REVENUE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input id="amount" name="amount" type="number" min="1" step="0.01" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="e.g. Campus recruitment fee — Infosys" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receivedDate">Date received</Label>
              <Input id="receivedDate" name="receivedDate" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Company (optional)</Label>
              <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="None">{(value: string) => companies.find((company) => company.id === value)?.name ?? "None"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Linked drive (optional)</Label>
              <Select value={driveId} onValueChange={(v) => setDriveId(v ?? "")}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="None">{(value: string) => drives.find((drive) => drive.id === value)?.title ?? "None"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {drives.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Linked event (optional)</Label>
              <Select value={eventId} onValueChange={(v) => setEventId(v ?? "")}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="None">{(value: string) => events.find((event) => event.id === value)?.title ?? "None"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record revenue"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
