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

type Company = { id: string; name: string };
type Course = { id: string; name: string; specialization: string | null };
type Department = { id: string; name: string };
type StaffMember = { id: string; name: string };

const STATUS_OPTIONS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "SELECTION_ONGOING",
  "COMPLETED",
  "ARCHIVED",
  "SUSPENDED",
  "CANCELLED",
  "REJECTED",
];
const LOCATION_OPTIONS = ["ON_CAMPUS", "OFF_CAMPUS", "POOL_CAMPUS", "VIRTUAL"];
const POSITION_TYPE_OPTIONS = ["JOB", "INTERNSHIP", "JOB_AND_INTERNSHIP"];
const SOURCE_OPTIONS = [
  { value: "SELF", label: "Self" },
  { value: "INBOUND", label: "Inbound" },
];

const BASIC_KEYS = ["status", "companyId", "courseId", "locationCategory", "positionType"];
const ADVANCED_KEYS = [
  "departmentId",
  "sourceType",
  "createdById",
  "minCtc",
  "maxCtc",
  "regClosesFrom",
  "regClosesTo",
  "driveDateFrom",
  "driveDateTo",
  "minApplications",
  "minShortlisted",
  "minOffers",
  "hasEligibilityRule",
  "hasInterviews",
  "hasOffers",
];
const FILTER_KEYS = [...BASIC_KEYS, ...ADVANCED_KEYS];

export function DrivesFilterPanel({ companies, courses, departments, staff }: { companies: Company[]; courses: Course[]; departments: Department[]; staff: StaffMember[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [...BASIC_KEYS, "departmentId", "sourceType", "createdById", "minCtc", "maxCtc", "regClosesFrom", "regClosesTo", "driveDateFrom", "driveDateTo", "minApplications", "minShortlisted", "minOffers"]) {
      const v = fd.get(key);
      if (v && String(v).trim()) params.set(key, String(v));
      else params.delete(key);
    }
    for (const key of ["hasEligibilityRule", "hasInterviews", "hasOffers"]) {
      if (fd.get(key) === "on") params.set(key, "1");
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
            <Label>Organisation</Label>
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
            <Label>Eligible course</Label>
            <Select name="courseId" defaultValue={searchParams.get("courseId") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.specialization ?? c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Location / Work mode</Label>
              <Select name="locationCategory" defaultValue={searchParams.get("locationCategory") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {LOCATION_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l.replaceAll("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Position type</Label>
              <Select name="positionType" defaultValue={searchParams.get("positionType") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {POSITION_TYPE_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p.replaceAll("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label>Source</Label>
              <Select name="sourceType" defaultValue={searchParams.get("sourceType") ?? undefined}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Created by</Label>
            <Select name="createdById" defaultValue={searchParams.get("createdById") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minCtc">Min CTC (₹)</Label>
              <Input id="minCtc" name="minCtc" type="number" min={0} defaultValue={searchParams.get("minCtc") ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxCtc">Max CTC (₹)</Label>
              <Input id="maxCtc" name="maxCtc" type="number" min={0} defaultValue={searchParams.get("maxCtc") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Registration date range</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="regClosesFrom" type="date" defaultValue={searchParams.get("regClosesFrom") ?? ""} />
              <Input name="regClosesTo" type="date" defaultValue={searchParams.get("regClosesTo") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Drive date range</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="driveDateFrom" type="date" defaultValue={searchParams.get("driveDateFrom") ?? ""} />
              <Input name="driveDateTo" type="date" defaultValue={searchParams.get("driveDateTo") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Activity thresholds</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input name="minApplications" type="number" min={0} placeholder="Min applications" defaultValue={searchParams.get("minApplications") ?? ""} />
              <Input name="minShortlisted" type="number" min={0} placeholder="Min shortlisted" defaultValue={searchParams.get("minShortlisted") ?? ""} />
              <Input name="minOffers" type="number" min={0} placeholder="Min offers" defaultValue={searchParams.get("minOffers") ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="hasEligibilityRule" defaultChecked={searchParams.get("hasEligibilityRule") === "1"} />
              Has a published eligibility rule
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="hasInterviews" defaultChecked={searchParams.get("hasInterviews") === "1"} />
              Has interview rounds
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="hasOffers" defaultChecked={searchParams.get("hasOffers") === "1"} />
              Has offers made
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
