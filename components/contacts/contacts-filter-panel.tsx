"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONTACT_TYPES, RELATIONSHIP_STAGES, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

type Company = { id: string; name: string };
type StaffUser = { id: string; name: string };

const FILTER_KEYS = ["companyId", "contactType", "relationshipStage", "ownerId", "status", "tags", "followUpStatus"];

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "none", label: "No follow-up set" },
] as const;

export function ContactsFilterPanel({ companies, users }: { companies: Company[]; users: StaffUser[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      const v = fd.get(key);
      if (v && String(v).trim()) params.set(key, String(v));
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Filter className="size-3.5" /> Filters
            {activeCount > 0 && (
              <span className="bg-primary text-primary-foreground ml-1 flex size-4 items-center justify-center rounded-full text-[10px]">
                {activeCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="max-h-[85vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Company</Label>
            <Select name="companyId" defaultValue={searchParams.get("companyId") ?? undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any">{(v: string) => companies.find((c) => c.id === v)?.name ?? "Any"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Contact type</Label>
            <Select name="contactType" defaultValue={searchParams.get("contactType") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Relationship stage</Label>
            <Select name="relationshipStage" defaultValue={searchParams.get("relationshipStage") ?? undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any">{(v: string) => RELATIONSHIP_STAGE_LABELS[v as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? "Any"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{RELATIONSHIP_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Owner</Label>
            <Select name="ownerId" defaultValue={searchParams.get("ownerId") ?? undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any">
                  {(v: string) => (v === "__unassigned__" ? "Unassigned" : (users.find((u) => u.id === v)?.name ?? "Any"))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={searchParams.get("status") ?? undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any">{(v: string) => (v === "active" ? "Active" : v === "inactive" ? "Inactive" : "Any")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Follow-up status</Label>
            <Select name="followUpStatus" defaultValue={searchParams.get("followUpStatus") ?? undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any">{(v: string) => FOLLOW_UP_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? "Any"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" name="tags" placeholder="e.g. Priority Recruiter" defaultValue={searchParams.get("tags") ?? ""} />
          </div>

          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-3.5" /> Clear all
            </Button>
            <Button type="submit" size="sm">Apply filters</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
