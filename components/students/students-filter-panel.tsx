"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Course = { id: string; name: string; specialization: string | null };
type Batch = { id: string; year: number };
type Department = { id: string; name: string };

const FILTER_KEYS = [
  "courseId",
  "batchId",
  "departmentId",
  "minCgpa",
  "maxCgpa",
  "minTenth",
  "maxTenth",
  "minTwelfth",
  "maxTwelfth",
  "minDiploma",
  "maxDiploma",
  "maxBacklogs",
  "offCampus",
  "hasBacklogs",
  "hasHistoricalBacklogs",
  "eligible",
  "placementStatus",
  "interestedJobs",
  "interestedInternships",
];

export function StudentsFilterPanel({ courses, batches, departments }: { courses: Course[]; batches: Batch[]; departments: Department[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "courseId",
      "batchId",
      "departmentId",
      "minCgpa",
      "maxCgpa",
      "minTenth",
      "maxTenth",
      "minTwelfth",
      "maxTwelfth",
      "minDiploma",
      "maxDiploma",
      "maxBacklogs",
      "placementStatus",
      "offCampus",
    ]) {
      const v = fd.get(key);
      if (v && String(v).trim()) params.set(key, String(v));
      else params.delete(key);
    }
    for (const key of ["eligible", "interestedJobs", "interestedInternships", "hasBacklogs", "hasHistoricalBacklogs"]) {
      if (fd.get(key) === "on") params.set(key, "1");
      else params.delete(key);
    }
    params.delete("page");
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
      <PopoverContent align="end" className="max-h-[min(85dvh,42rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
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
            <div className="flex flex-col gap-1.5">
              <Label>Batch</Label>
              <Select name="batchId" defaultValue={searchParams.get("batchId") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Placement status</Label>
              <Select name="placementStatus" defaultValue={searchParams.get("placementStatus") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACED">Placed</SelectItem>
                  <SelectItem value="SEEKING">Seeking</SelectItem>
                  <SelectItem value="NOT_INTERESTED">Not interested</SelectItem>
                  <SelectItem value="OPTED_OUT">Opted out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Placed via</Label>
              {/* A separate axis from Placement status: this asks HOW they
                  were placed, so a TPO can pull up everyone who found their
                  own job or internship. */}
              <Select name="offCampus" defaultValue={searchParams.get("offCampus") ?? undefined}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any route">
                    {(v: string) =>
                      v === "any"
                        ? "Off-campus (any)"
                        : v === "JOB"
                          ? "Off-campus job"
                          : v === "INTERNSHIP"
                            ? "Off-campus internship"
                            : v === "none"
                              ? "Campus drives only"
                              : "Any route"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Off-campus (any)</SelectItem>
                  <SelectItem value="JOB">Off-campus job</SelectItem>
                  <SelectItem value="INTERNSHIP">Off-campus internship</SelectItem>
                  <SelectItem value="none">Campus drives only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minCgpa">Min CGPA</Label>
              <Input id="minCgpa" name="minCgpa" type="number" step="0.1" min={0} max={10} defaultValue={searchParams.get("minCgpa") ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxCgpa">Max CGPA</Label>
              <Input id="maxCgpa" name="maxCgpa" type="number" step="0.1" min={0} max={10} defaultValue={searchParams.get("maxCgpa") ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxBacklogs">Max backlogs</Label>
              <Input id="maxBacklogs" name="maxBacklogs" type="number" min={0} defaultValue={searchParams.get("maxBacklogs") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Academic scores</Label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <Input name="minTenth" type="number" step="0.1" min={0} max={100} placeholder="Min 10th %" defaultValue={searchParams.get("minTenth") ?? ""} />
              <Input name="maxTenth" type="number" step="0.1" min={0} max={100} placeholder="Max 10th %" defaultValue={searchParams.get("maxTenth") ?? ""} />
              <div />
              <Input name="minTwelfth" type="number" step="0.1" min={0} max={100} placeholder="Min 12th %" defaultValue={searchParams.get("minTwelfth") ?? ""} />
              <Input name="maxTwelfth" type="number" step="0.1" min={0} max={100} placeholder="Max 12th %" defaultValue={searchParams.get("maxTwelfth") ?? ""} />
              <div />
              <Input name="minDiploma" type="number" step="0.1" min={0} max={100} placeholder="Min diploma %" defaultValue={searchParams.get("minDiploma") ?? ""} />
              <Input name="maxDiploma" type="number" step="0.1" min={0} max={100} placeholder="Max diploma %" defaultValue={searchParams.get("maxDiploma") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Placement policy</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="eligible" defaultChecked={searchParams.get("eligible") === "1"} />
              Eligible for placements
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="hasBacklogs" defaultChecked={searchParams.get("hasBacklogs") === "1"} />
              Has active backlogs
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="hasHistoricalBacklogs" defaultChecked={searchParams.get("hasHistoricalBacklogs") === "1"} />
              Has historical (cleared) backlogs
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="interestedJobs" defaultChecked={searchParams.get("interestedJobs") === "1"} />
              Interested in jobs
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="interestedInternships" defaultChecked={searchParams.get("interestedInternships") === "1"} />
              Interested in internships
            </label>
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
