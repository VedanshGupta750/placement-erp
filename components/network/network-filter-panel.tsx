"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Course = { id: string; name: string; specialization: string | null };
type Batch = { id: string; year: number };
type Department = { id: string; name: string };
type Skill = { id: string; name: string };

const USER_TYPE_OPTIONS = ["STUDENT", "FACULTY", "MANAGEMENT", "PLACEMENT_TEAM"];
const PLACEMENT_STATUS_OPTIONS = [
  { value: "eligible", label: "Eligible" },
  { value: "placed", label: "Placed" },
  { value: "in_process", label: "Looking for opportunity" },
  { value: "not_eligible", label: "Not eligible" },
];
const FILTER_KEYS = ["userType", "courseId", "batchId", "departmentId", "placementStatus", "skillId"];

export function NetworkFilterPanel({ courses, batches, departments, skills }: { courses: Course[]; batches: Batch[]; departments: Department[]; skills: Skill[] }) {
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
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-4">
        <form onSubmit={handleSubmit} className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label>Member type</Label>
            <Select name="userType" defaultValue={searchParams.get("userType") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {USER_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                {PLACEMENT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Skill</Label>
            <Select name="skillId" defaultValue={searchParams.get("skillId") ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                {skills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-3.5" /> Clear all
            </Button>
            <Button type="submit" size="sm">Apply</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
