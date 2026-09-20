"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EVENT_CATEGORY_LABEL, EVENT_STATUS_LABEL } from "@/lib/events/status";

type Option = { id: string; label: string };

const FILTER_KEYS = ["category", "status", "department", "batch", "mode", "organizer", "dateFrom", "dateTo"];

// Search bar + filters popover for the Events home. Same submit-a-form,
// push-search-params-to-the-URL shape as StudentsFilterPanel — the events
// list page (a server component) re-fetches on every navigation, so filter
// state lives entirely in the URL and survives refresh/back-forward.
export function EventFiltersBar({ departments, batches }: { departments: Option[]; batches: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  function pushSearch(nextQ: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    pushSearch(q);
  }

  function handleFiltersSubmit(e: FormEvent<HTMLFormElement>) {
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
    <div className="flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center">
      <form onSubmit={handleSearchSubmit} className="relative w-full min-w-0 min-[420px]:flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          placeholder="Search events by title or description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

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
        <PopoverContent align="end" className="max-h-[85vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-4">
          <form onSubmit={handleFiltersSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Event type</Label>
                <Select name="category" defaultValue={searchParams.get("category") ?? undefined}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_CATEGORY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select name="status" defaultValue={searchParams.get("status") ?? undefined}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select name="department" defaultValue={searchParams.get("department") ?? undefined}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Batch</Label>
                <Select name="batch" defaultValue={searchParams.get("batch") ?? undefined}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Mode</Label>
                <Select name="mode" defaultValue={searchParams.get("mode") ?? undefined}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="OFFLINE">Offline</SelectItem>
                    <SelectItem value="HYBRID">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="organizer">Organizer</Label>
                <Input id="organizer" name="organizer" placeholder="e.g. CDPC" defaultValue={searchParams.get("organizer") ?? ""} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateFrom">From</Label>
                <Input id="dateFrom" name="dateFrom" type="date" defaultValue={searchParams.get("dateFrom") ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateTo">To</Label>
                <Input id="dateTo" name="dateTo" type="date" defaultValue={searchParams.get("dateTo") ?? ""} />
              </div>
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
    </div>
  );
}
