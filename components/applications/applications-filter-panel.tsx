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
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

type Drive = { id: string; title: string; companyName: string };
type Department = { id: string; name: string };
type Course = { id: string; name: string; specialization: string | null };
type Company = { id: string; name: string };

const STATUS_OPTIONS = ["APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"];

// Every key the panel owns. Used for the active-count badge, for "Clear all",
// AND for submitting — they were three different lists before, which is how
// seven filters ended up unreachable (see SUBMIT_KEYS note below).
const FILTER_KEYS = [
  "driveId", "companyId", "status", "departmentId", "courseId",
  "appliedFrom", "appliedTo", "minBacklogs", "maxBacklogs",
  "minCgpa", "maxCgpa", "minTenth", "minTwelfth",
  "placement", "excludePlaced", "priority", "hasOffer",
];

// Text/number/date/select inputs read straight from FormData. The two
// checkbox-style keys are handled separately below.
const SUBMIT_KEYS = FILTER_KEYS.filter((k) => k !== "excludePlaced" && k !== "hasOffer");

const splitParam = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

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

    // Previously this looped over a hardcoded subset that omitted companyId,
    // minCgpa, maxCgpa, minTenth, minTwelfth and placement — so those six
    // controls rendered, accepted input, and silently did nothing because
    // the value never reached the URL the page reads. Derived from
    // FILTER_KEYS now so a new filter can't be added and left inert.
    for (const key of SUBMIT_KEYS) {
      const v = fd.get(key);
      if (v && String(v).trim()) params.set(key, String(v));
      else params.delete(key);
    }

    for (const key of ["excludePlaced", "hasOffer"]) {
      if (fd.get(key) === "on" || fd.get(key) === "1") params.set(key, "1");
      else params.delete(key);
    }

    // A filter change invalidates the page cursor, and the status tab is a
    // separate control — leave it alone.
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
      <PopoverContent align="end" className="w-[calc(100vw-1rem)] p-4 sm:w-96">
        <form onSubmit={handleSubmit} className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto overscroll-contain">
          <MultiSelectFilter
            label="Company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            initialSelected={splitParam(searchParams.get("companyId"))}
            searchable={companies.length > 12}
          />

          <MultiSelectFilter
            label="Drive"
            name="driveId"
            options={drives.map((d) => ({ value: d.id, label: `${d.companyName} — ${d.title}` }))}
            initialSelected={splitParam(searchParams.get("driveId"))}
            searchable={drives.length > 12}
          />

          <MultiSelectFilter
            label="Status"
            name="status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replaceAll("_", " ") }))}
            initialSelected={splitParam(searchParams.get("status"))}
          />

          <MultiSelectFilter
            label="Department"
            name="departmentId"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            initialSelected={splitParam(searchParams.get("departmentId"))}
          />

          <MultiSelectFilter
            label="Course"
            name="courseId"
            options={courses.map((c) => ({ value: c.id, label: c.specialization ?? c.name }))}
            initialSelected={splitParam(searchParams.get("courseId"))}
            searchable={courses.length > 12}
          />

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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any">
                    {(v: string) => (v === "placed" ? "Already placed" : v === "unplaced" ? "Not yet placed" : "Any")}
                  </SelectValue>
                </SelectTrigger>
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
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any">
                  {(v: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase() : "Any")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-background sticky bottom-0 flex justify-between gap-2 border-t pt-3">
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
