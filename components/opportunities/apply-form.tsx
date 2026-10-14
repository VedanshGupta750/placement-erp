"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileWarning, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ExtraField = { id: string; label: string; fieldType: string; required: boolean };

export function ApplyForm({
  driveId,
  positions,
  resumes,
  matchScore,
  extraFields = [],
}: {
  driveId: string;
  /** Only resumes with a file behind them — the page filters these out. */
  positions: { id: string; title: string; positionType: string }[];
  resumes: { id: string; name: string; isDefault: boolean }[];
  matchScore: number | null;
  extraFields?: ExtraField[];
}) {
  const router = useRouter();
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  // Pre-selected only when there is exactly one resume. With several, the
  // student picks deliberately rather than silently sending whichever one
  // happens to be the default to this particular company.
  const [resumeId, setResumeId] = useState(resumes.length === 1 ? resumes[0].id : "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasResume = resumes.length > 0;

  async function handleApply() {
    if (!positionId) {
      setError("Select a position to apply for.");
      return;
    }
    // Mirrors the server rule in /api/applications. Checked here too so the
    // student gets told which field is missing instead of a generic failure.
    if (!resumeId) {
      setError(hasResume ? "Select the resume you want to send." : "Upload a resume before applying.");
      return;
    }
    const missing = extraFields.find((f) => f.required && !fieldValues[f.id]?.trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driveId,
        positionId,
        resumeId,
        fieldValues: Object.entries(fieldValues).map(([fieldId, value]) => ({ fieldId, value })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      setError(data.message ?? fieldMessage ?? "Something went wrong.");
      return;
    }
    toast.success("Application submitted");
    router.refresh();
  }

  // No usable resume means there is nothing to apply *with*, so the form
  // doesn't render at all — previously this said "you can still apply",
  // which let students send applications a recruiter couldn't screen.
  if (!hasResume) {
    return (
      <div className="flex flex-col items-start gap-3">
        <span className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 flex size-9 items-center justify-center rounded-lg">
          <FileWarning className="size-4.5" />
        </span>
        <div>
          <p className="text-sm font-medium">Upload a resume to apply</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Every application has to carry a resume — it&apos;s what the company screens you on. Add one and this
            drive will be ready to apply to.
          </p>
        </div>
        <Button size="sm" render={<Link href="/resumes" />}>
          <Upload className="size-3.5" /> Go to Resumes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {matchScore !== null && (
        <p className="text-muted-foreground text-sm">
          Your predicted skill match is <span className="text-foreground font-medium">{matchScore}%</span> for this drive.
        </p>
      )}

      {positions.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label>Position</Label>
          <Select value={positionId} onValueChange={(v) => v && setPositionId(v)}>
            {/* Base UI's Select.Value renders the raw VALUE unless given a
                render function — and the value here is a cuid, so without
                this the trigger showed the id instead of the title. */}
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => {
                  const p = positions.find((x) => x.id === v);
                  return p ? `${p.title} (${p.positionType.replaceAll("_", " ")})` : "Select a position";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title} ({p.positionType.replaceAll("_", " ")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Resume *</Label>
        <Select value={resumeId} onValueChange={(v) => v && setResumeId(v)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => {
                const r = resumes.find((x) => x.id === v);
                return r ? `${r.name}${r.isDefault ? " (default)" : ""}` : "Select a resume";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {resumes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}{r.isDefault ? " (default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          This is the file the company receives.{" "}
          <Link href="/resumes" className="hover:text-foreground underline">
            Manage your resumes
          </Link>
        </p>
      </div>

      {extraFields.map((f) => (
        <div key={f.id} className="flex flex-col gap-1.5">
          <Label htmlFor={`field-${f.id}`}>{f.label}{f.required ? " *" : ""}</Label>
          <Input
            id={`field-${f.id}`}
            type={f.fieldType === "NUMBER" ? "number" : f.fieldType === "DATE" ? "date" : "text"}
            value={fieldValues[f.id] ?? ""}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
            required={f.required}
          />
        </div>
      ))}

      {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}

      <Button disabled={pending || !resumeId} onClick={handleApply}>
        {pending ? "Applying…" : "Apply"}
      </Button>
    </div>
  );
}
