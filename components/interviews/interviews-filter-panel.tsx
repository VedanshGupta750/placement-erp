"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Drive = { id: string; title: string; companyName: string };

const STATUS_OPTIONS = ["ASSIGNED", "SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "PASSED", "FAILED", "NO_SHOW", "CANCELLED"];
const FILTER_KEYS = ["driveId", "roundType", "status", "mode", "interviewer", "dateFrom", "dateTo"];

export function InterviewsFilterPanel({ drives, roundTypes, interviewers }: { drives: Drive[]; roundTypes: string[]; interviewers: string[] }) {
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
      <PopoverContent align="end" className="w-96 p-4">
        <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label>Drive</Label>
            <Select name="driveId" defaultValue={searchParams.get("driveId") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {drives.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.companyName} — {d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Round type</Label>
              <Select name="roundType" defaultValue={searchParams.get("roundType") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {roundTypes.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mode</Label>
              <Select name="mode" defaultValue={searchParams.get("mode") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONLINE">Online</SelectItem>
                  <SelectItem value="OFFLINE">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={searchParams.get("status") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Interviewer</Label>
            <Select name="interviewer" defaultValue={searchParams.get("interviewer") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {interviewers.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Scheduled date range</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="dateFrom" type="date" defaultValue={searchParams.get("dateFrom") ?? ""} />
              <Input name="dateTo" type="date" defaultValue={searchParams.get("dateTo") ?? ""} />
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
  );
}
