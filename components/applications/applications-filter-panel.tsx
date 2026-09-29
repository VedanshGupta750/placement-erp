"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type Drive = { id: string; title: string; companyName: string };
type Department = { id: string; name: string };
type Course = { id: string; name: string; specialization: string | null };
type Company = { id: string; name: string };

const STATUS_OPTIONS = ["APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"];

const FILTER_KEYS = ["driveId", "companyId", "status", "departmentId", "courseId", "appliedFrom", "appliedTo",
  "minBacklogs", "maxBacklogs", "minCgpa", "maxCgpa", "minTenth", "minTwelfth", "placement", "excludePlaced",
  "priority", "hasOffer"];

export function ApplicationsFilterPanel({ drives, departments, courses, companies }: {
  drives: Drive[];
  departments: Department[];
  courses: Course[];
  companies: Company[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["driveId", "status", "departmentId", "courseId", "appliedFrom", "appliedTo", "minBacklogs", "maxBacklogs", "priority"]) {
      const v = fd.get(key);
      if (v && String(v).trim()) params.set(key, String(v));
      else params.delete(key);
    }
    if (fd.get("hasOffer") === "on") params.set("hasOffer", "1");
    else params.delete("hasOffer");
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
            <Label>Company</Label>
            <Select name="companyId" defaultValue={searchParams.get("companyId") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Department</Label>
              <Select name="departmentId" defaultValue={searchParams.get("departmentId") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Course</Label>
              <Select name="courseId" defaultValue={searchParams.get("courseId") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.specialization ?? c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Applied date range</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="appliedFrom" type="date" defaultValue={searchParams.get("appliedFrom") ?? ""} />
              <Input name="appliedTo" type="date" defaultValue={searchParams.get("appliedTo") ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minBacklogs">Min backlogs</Label>
              <Input id="minBacklogs" name="minBacklogs" type="number" min={0} defaultValue={searchParams.get("minBacklogs") ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxBacklogs">Max backlogs</Label>
              <Input id="maxBacklogs" name="maxBacklogs" type="number" min={0} defaultValue={searchParams.get("maxBacklogs") ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minCgpa">Min CGPA</Label>
              <Input id="minCgpa" name="minCgpa" type="number" step="0.1" min={0} max={10} defaultValue={searchParams.get("minCgpa") ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxCgpa">Max CGPA</Label>
              <Input id="maxCgpa" name="maxCgpa" type="number" step="0.1" min={0} max={10} defaultValue={searchParams.get("maxCgpa") ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minTenth">Min 10th %</Label>
              <Input id="minTenth" name="minTenth" type="number" step="0.1" min={0} max={100} defaultValue={searchParams.get("minTenth") ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minTwelfth">Min 12th %</Label>
              <Input id="minTwelfth" name="minTwelfth" type="number" step="0.1" min={0} max={100} defaultValue={searchParams.get("minTwelfth") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Placement policy</Label>
            <div className="flex flex-col gap-1.5">
              <Label>Placement status</Label>
              <Select name="placement" defaultValue={searchParams.get("placement") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="placed">Already placed</SelectItem>
                  <SelectItem value="unplaced">Not yet placed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox name="excludePlaced" value="1" defaultChecked={searchParams.get("excludePlaced") === "1"} />
              <span>
                Exclude already-placed students
                <span className="text-muted-foreground block text-xs">
                  Drops anyone holding an accepted or joined offer, whichever drive it came from.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select name="priority" defaultValue={searchParams.get("priority") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
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
