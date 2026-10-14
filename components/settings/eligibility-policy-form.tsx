"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type EligibilityPolicyValues = {
  eligibilityPolicyEnabled: boolean;
  eligibilityMinCgpa: number | null;
  eligibilityMaxLiveBacklogs: number | null;
  eligibilityMinTenthScore: number | null;
  eligibilityMinTwelfthScore: number | null;
  eligibilityRequireAcademics: boolean;
};

const THRESHOLDS: {
  key: keyof EligibilityPolicyValues;
  label: string;
  hint: string;
  step: string;
  min: number;
  max: number;
}[] = [
  { key: "eligibilityMinCgpa", label: "Minimum CGPA", hint: "out of 10", step: "0.01", min: 0, max: 10 },
  { key: "eligibilityMinTenthScore", label: "Minimum 10th %", hint: "percentage", step: "0.01", min: 0, max: 100 },
  { key: "eligibilityMinTwelfthScore", label: "Minimum 12th %", hint: "percentage", step: "0.01", min: 0, max: 100 },
  { key: "eligibilityMaxLiveBacklogs", label: "Maximum live backlogs", hint: "0 means none allowed", step: "1", min: 0, max: 50 },
];

export function EligibilityPolicyForm({ initial }: { initial: EligibilityPolicyValues }) {
  const router = useRouter();
  const [values, setValues] = useState<EligibilityPolicyValues>(initial);
  const [pending, setPending] = useState(false);

  const enabled = values.eligibilityPolicyEnabled;
  const noRules =
    values.eligibilityMinCgpa === null &&
    values.eligibilityMaxLiveBacklogs === null &&
    values.eligibilityMinTenthScore === null &&
    values.eligibilityMinTwelfthScore === null &&
    !values.eligibilityRequireAcademics;

  function setNumber(key: keyof EligibilityPolicyValues, raw: string) {
    // An empty box means "don't check this", which is a different rule from
    // a threshold of 0 — so it has to become null, not 0.
    setValues((p) => ({ ...p, [key]: raw.trim() === "" ? null : Number(raw) }));
  }

  async function save() {
    setPending(true);
    const res = await fetch("/api/settings/eligibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      toast.error(data.message ?? fieldMessage ?? "Couldn't save the eligibility policy.");
      return;
    }
    toast.success("Eligibility policy saved.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
        <div className="flex min-w-0 gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Decide eligibility from academic rules</p>
            <p className="text-muted-foreground mt-1 text-sm">
              With this off, a student counts as eligible unless someone unticks them by hand — their CGPA and
              backlogs are shown on the roster but decide nothing. Turn it on to have these figures set the status
              instead.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setValues((p) => ({ ...p, eligibilityPolicyEnabled: v === true }))}
          aria-label="Decide eligibility from academic rules"
        />
      </div>

      <div className={enabled ? "flex flex-col gap-5" : "pointer-events-none flex flex-col gap-5 opacity-50"}>
        <div className="grid gap-3 sm:grid-cols-2">
          {THRESHOLDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                min={f.min}
                max={f.max}
                value={values[f.key] === null ? "" : String(values[f.key])}
                onChange={(e) => setNumber(f.key, e.target.value)}
                placeholder="No limit"
                disabled={!enabled}
              />
              <p className="text-muted-foreground text-xs">
                Leave blank to ignore this · {f.hint}
              </p>
            </div>
          ))}
        </div>

        <label className="flex items-start gap-3 rounded-lg border p-3">
          <Switch
            checked={values.eligibilityRequireAcademics}
            onCheckedChange={(v) => setValues((p) => ({ ...p, eligibilityRequireAcademics: v === true }))}
            disabled={!enabled}
            aria-label="Require academic records on file"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">Treat a missing figure as a fail</span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Off by default: a student whose results aren&apos;t published yet keeps their eligibility instead of
              being excluded for a number nobody has entered. Turn on once academic records are complete.
            </span>
          </span>
        </label>

        {enabled && noRules && (
          <p className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <Info className="mt-0.5 size-4 shrink-0" />
            The policy is on but no thresholds are set, so it passes every student — the same result as leaving it
            off. Set at least one limit above.
          </p>
        )}
      </div>

      <div className="text-muted-foreground flex gap-2 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          A student you have excluded by hand on their own profile stays excluded whatever this policy says. This
          decides the roster status and who may apply to drives; a drive&apos;s own eligibility rule is separate and
          still applies on top.
        </p>
      </div>

      <div className="flex justify-end">
        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save policy"}
        </Button>
      </div>
    </div>
  );
}
