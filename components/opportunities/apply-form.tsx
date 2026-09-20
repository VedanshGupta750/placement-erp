"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  positions: { id: string; title: string; positionType: string }[];
  resumes: { id: string; name: string; isDefault: boolean }[];
  matchScore: number | null;
  extraFields?: ExtraField[];
}) {
  const router = useRouter();
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!positionId) {
      setError("Select a position to apply for.");
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
        resumeId: resumeId || undefined,
        fieldValues: Object.entries(fieldValues).map(([fieldId, value]) => ({ fieldId, value })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.message ?? "Something went wrong.");
      return;
    }
    toast.success("Application submitted");
    router.refresh();
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

      {resumes.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label>Resume</Label>
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
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          You haven&apos;t uploaded a resume yet — you can still apply, or add one from the Resumes page first.
        </p>
      )}

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

      <Button disabled={pending} onClick={handleApply}>
        {pending ? "Applying…" : "Apply"}
      </Button>
    </div>
  );
}
