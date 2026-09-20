"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HIRING_TYPES, PARTNERSHIP_STATUS_LABELS } from "@/lib/validators/company";

const FILTER_KEYS = ["status", "industryType", "hiringType"];

export function CompaniesFilterPanel({ industries }: { industries: string[] }) {
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
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
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
      <PopoverContent align="end" className="w-80 p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={searchParams.get("status") ?? undefined}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARTNERSHIP_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Industry</Label>
            <Select name="industryType" defaultValue={searchParams.get("industryType") ?? undefined}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {industries.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Hiring type</Label>
            <Select name="hiringType" defaultValue={searchParams.get("hiringType") ?? undefined}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {HIRING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
