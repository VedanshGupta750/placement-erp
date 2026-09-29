"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParseJdDialog, type ParsedJd } from "@/components/drives/parse-jd-dialog";
import { Check } from "lucide-react";

type FormState = {
  title: string;
  companyName: string;
  positionType: string;
  employmentType: string;
  locationCategory: string;
  expectedOpenings: string;
  minCtc: string;
  maxCtc: string;
  maxStipend: string;
  courseIds: string[];
  skillIds: string[];
  eligibilityCriteria: string;
  registrationClosesAt: string;
  selectionProcessDetails: string;
  contactPersons: string;
  otherDetails: string;
};

const INITIAL_STATE: FormState = {
  title: "",
  companyName: "",
  positionType: "JOB",
  employmentType: "FULL_TIME",
  locationCategory: "ON_CAMPUS",
  expectedOpenings: "",
  minCtc: "",
  maxCtc: "",
  maxStipend: "",
  courseIds: [],
  skillIds: [],
  eligibilityCriteria: "",
  registrationClosesAt: "",
  selectionProcessDetails: "",
  contactPersons: "",
  otherDetails: "",
};

const STEPS = ["Basic Details", "Position & Compensation", "Eligibility", "Selection Process", "Review & Publish"] as const;

const VALID_POSITION_TYPES = new Set(["JOB", "INTERNSHIP", "JOB_AND_INTERNSHIP"]);

export function NewDriveForm({
  courses,
  skills,
  initialCompanyName,
  initialPositionType,
  batches,
  defaultBatchId,
}: {
  courses: { id: string; name: string; specialization: string | null }[];
  skills: { id: string; name: string }[];
  initialCompanyName?: string;
  initialPositionType?: string;
  batches: { id: string; year: number }[];
  defaultBatchId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  // Which graduating cohort this drive hires from. Defaults to the batch the
  // user is currently working in, not simply the newest year.
  const [batchId, setBatchId] = useState(defaultBatchId);
  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    companyName: initialCompanyName ?? "",
    positionType: initialPositionType && VALID_POSITION_TYPES.has(initialPositionType) ? initialPositionType : INITIAL_STATE.positionType,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function toggleId(key: "courseIds" | "skillIds", id: string) {
    setForm((prev) => ({ ...prev, [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id] }));
  }

  useEffect(() => {
    if (step !== STEPS.length - 1) return;
    fetch("/api/drives/eligible-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds: form.courseIds }),
    })
      .then((r) => r.json())
      .then((data) => setEligibleCount(data.count ?? null))
      .catch(() => setEligibleCount(null));
  }, [step, form.courseIds]);

  function applyParsedJd(parsed: ParsedJd) {
    const lowerSkillNames = parsed.skillNames.map((s) => s.toLowerCase());
    const matchedSkillIds = skills.filter((s) => lowerSkillNames.some((name) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()))).map((s) => s.id);

    const lowerCourseNames = parsed.courseNames.map((c) => c.toLowerCase());
    const matchedCourseIds = courses
      .filter((c) => lowerCourseNames.some((name) => (c.specialization ?? c.name).toLowerCase().includes(name) || name.includes((c.specialization ?? c.name).toLowerCase())))
      .map((c) => c.id);

    setForm((prev) => ({
      ...prev,
      title: parsed.title || prev.title,
      companyName: parsed.companyName || prev.companyName,
      positionType: parsed.positionType,
      employmentType: parsed.employmentType,
      locationCategory: parsed.locationCategory,
      minCtc: parsed.minCtc != null ? String(parsed.minCtc) : prev.minCtc,
      maxCtc: parsed.maxCtc != null ? String(parsed.maxCtc) : prev.maxCtc,
      maxStipend: parsed.maxStipend != null ? String(parsed.maxStipend) : prev.maxStipend,
      expectedOpenings: parsed.expectedOpenings != null ? String(parsed.expectedOpenings) : prev.expectedOpenings,
      eligibilityCriteria: parsed.eligibilityCriteria || prev.eligibilityCriteria,
      selectionProcessDetails: parsed.selectionProcessDetails || prev.selectionProcessDetails,
      skillIds: matchedSkillIds.length > 0 ? matchedSkillIds : prev.skillIds,
      courseIds: matchedCourseIds.length > 0 ? matchedCourseIds : prev.courseIds,
    }));
  }

  function canAdvance() {
    if (step === 0) return form.title.trim().length >= 3 && form.companyName.trim().length >= 2;
    if (step === 2) return form.courseIds.length > 0;
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      title: form.title,
      companyName: form.companyName,
      positionType: form.positionType,
      employmentType: form.employmentType,
      locationCategory: form.locationCategory,
      minCtc: form.minCtc || undefined,
      maxCtc: form.maxCtc || undefined,
      maxStipend: form.maxStipend || undefined,
      expectedOpenings: form.expectedOpenings || undefined,
      eligibilityCriteria: form.eligibilityCriteria || undefined,
      registrationClosesAt: form.registrationClosesAt || undefined,
      selectionProcessDetails: form.selectionProcessDetails || undefined,
      contactPersons: form.contactPersons || undefined,
      otherDetails: form.otherDetails || undefined,
      courseIds: form.courseIds,
      skillIds: form.skillIds,
      batchId,
    };

    const res = await fetch("/api/drives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? (Object.values(data.fieldErrors ?? {}).flat()[0] as string) ?? "Something went wrong.");
      setPending(false);
      return;
    }
    router.push(`/drives/${data.id}`);
  }

  const courseLabel = (id: string) => {
    const c = courses.find((x) => x.id === id);
    return c ? (c.specialization ?? c.name) : id;
  };
  const skillLabel = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "text-muted-foreground bg-muted"
                }`}
              >
                {i < step ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
                {s}
              </button>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        <ParseJdDialog onParsed={applyParsedJd} />
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="title">Drive title *</Label>
              <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Software Engineer - Campus Drive" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">Organisation *</Label>
              <Input id="companyName" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Company name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Batch (graduating year) *</Label>
              <Select value={batchId} onValueChange={(v) => v && setBatchId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a batch">
                    {(v: string) => batches.find((b) => b.id === v)?.year?.toString() ?? "Select a batch"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground -mt-1 text-xs">
                Only students in this batch are considered for eligibility.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Drive type</Label>
              <Select value={form.positionType} onValueChange={(v) => v && set("positionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="JOB">Job</SelectItem>
                  <SelectItem value="INTERNSHIP">Internship</SelectItem>
                  <SelectItem value="JOB_AND_INTERNSHIP">Job and Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Position & Compensation</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Employment type</Label>
              <Select value={form.employmentType} onValueChange={(v) => v && set("employmentType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Full Time</SelectItem>
                  <SelectItem value="PART_TIME">Part Time</SelectItem>
                  <SelectItem value="INTERNSHIP">Internship</SelectItem>
                  <SelectItem value="INTERNSHIP_PLUS_PPO">Internship + PPO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Location category</Label>
              <Select value={form.locationCategory} onValueChange={(v) => v && set("locationCategory", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ON_CAMPUS">On Campus</SelectItem>
                  <SelectItem value="OFF_CAMPUS">Off Campus</SelectItem>
                  <SelectItem value="POOL_CAMPUS">Pool Campus</SelectItem>
                  <SelectItem value="VIRTUAL">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expectedOpenings">Expected openings</Label>
              <Input id="expectedOpenings" type="number" min={0} value={form.expectedOpenings} onChange={(e) => set("expectedOpenings", e.target.value)} />
            </div>
            <div />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minCtc">Min CTC (₹)</Label>
              <Input id="minCtc" type="number" min={0} value={form.minCtc} onChange={(e) => set("minCtc", e.target.value)} placeholder="450000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxCtc">Max CTC (₹)</Label>
              <Input id="maxCtc" type="number" min={0} value={form.maxCtc} onChange={(e) => set("maxCtc", e.target.value)} placeholder="700000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxStipend">Max stipend / month (₹)</Label>
              <Input id="maxStipend" type="number" min={0} value={form.maxStipend} onChange={(e) => set("maxStipend", e.target.value)} placeholder="15000" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Eligible courses *</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {courses.map((c) => (
                <label key={c.id} className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <Checkbox checked={form.courseIds.includes(c.id)} onCheckedChange={() => toggleId("courseIds", c.id)} />
                  {c.specialization ?? c.name}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Required skills</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleId("skillIds", s.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    form.skillIds.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="eligibilityCriteria">Eligibility criteria (notes)</Label>
                <Textarea id="eligibilityCriteria" rows={2} value={form.eligibilityCriteria} onChange={(e) => set("eligibilityCriteria", e.target.value)} placeholder="No active backlogs. Minimum 60% throughout academics." />
                <p className="text-muted-foreground text-xs">A structured, enforced eligibility rule (CGPA/backlogs/etc.) can be published from the drive&apos;s Eligibility tab after creation — this is a free-text note shown to students.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="registrationClosesAt">Registration closes</Label>
                <Input id="registrationClosesAt" type="date" value={form.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} className="max-w-xs" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Selection Process</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="selectionProcessDetails">Selection process</Label>
              <Textarea id="selectionProcessDetails" rows={2} value={form.selectionProcessDetails} onChange={(e) => set("selectionProcessDetails", e.target.value)} placeholder="Online Test -> Technical Interview -> HR Interview" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPersons">Contact persons</Label>
              <Input id="contactPersons" value={form.contactPersons} onChange={(e) => set("contactPersons", e.target.value)} placeholder="HR name, email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otherDetails">Other details</Label>
              <Textarea id="otherDetails" rows={2} value={form.otherDetails} onChange={(e) => set("otherDetails", e.target.value)} placeholder="Anything else students or the placement team should know." />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Review & Publish</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">Drive title</span><span className="font-medium">{form.title || "—"}</span></div>
            <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">Company</span><span className="font-medium">{form.companyName || "—"}</span></div>
            <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">Drive type</span><span className="font-medium">{form.positionType.replaceAll("_", " ")}</span></div>
            <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">Employment type</span><span className="font-medium">{form.employmentType.replaceAll("_", " ")}</span></div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">CTC</span>
              <span className="font-medium">{form.minCtc || form.maxCtc ? `₹${Number(form.minCtc || 0).toLocaleString("en-IN")} – ₹${Number(form.maxCtc || 0).toLocaleString("en-IN")}` : "—"}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">Openings</span><span className="font-medium">{form.expectedOpenings || "—"}</span></div>
            <div className="flex items-center justify-between border-b pb-2"><span className="text-muted-foreground">Registration closes</span><span className="font-medium">{form.registrationClosesAt || "—"}</span></div>
            <div className="flex flex-col gap-1.5 border-b pb-2">
              <span className="text-muted-foreground">Eligible courses</span>
              <div className="flex flex-wrap gap-1.5">
                {form.courseIds.map((id) => <Badge key={id} variant="outline">{courseLabel(id)}</Badge>)}
                {form.courseIds.length === 0 && <span className="font-medium">—</span>}
              </div>
            </div>
            {form.skillIds.length > 0 && (
              <div className="flex flex-col gap-1.5 border-b pb-2">
                <span className="text-muted-foreground">Required skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {form.skillIds.map((id) => <Badge key={id} variant="outline">{skillLabel(id)}</Badge>)}
                </div>
              </div>
            )}

            <div className="bg-accent/50 mt-2 rounded-md px-3 py-2.5">
              <span className="font-semibold tabular-nums">{eligibleCount ?? "…"}</span> students currently in the selected courses (before any published eligibility rule narrows it further).
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={!canAdvance()} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Next
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save as draft"}
          </Button>
        )}
      </div>
    </form>
  );
}
