"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Rule = { id: string; version: number; isPublished: boolean; publishedAt: string | null };
type Skill = { id: string; name: string };
type EligibilityCheck = { field: string; passed: boolean };
type EvalResult = {
  studentId: string;
  eligible: boolean;
  checks: EligibilityCheck[];
  ruleEligible: boolean;
  overridden: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  cgpa: "CGPA below threshold",
  active_backlogs: "Active backlogs above allowed limit",
  batch_year: "Batch year not eligible",
  course_id: "Branch/course not eligible",
  department_id: "Department not eligible",
  tenth_score: "10th % below threshold",
  twelfth_score: "12th % below threshold",
  diploma_score: "Diploma % below threshold",
  closed_backlogs: "Historical backlogs above allowed limit",
  skill_ids: "Missing a required skill",
  has_experience: "No work experience on file",
  has_certification: "No certification on file",
};

// Every excluded student failed at least one condition — attribute them to
// the FIRST failing check in evaluation order, so the counts sum exactly to
// notEligibleCount instead of double-counting a student against every rule
// they happened to fail. A student held out by a manual override may have
// passed every check, so they are attributed to the override instead of to
// a rule they never actually failed.
function summarizeExclusionReasons(results: EvalResult[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.eligible) continue;
    const label = r.overridden
      ? "Held out by a manual override"
      : (() => {
          const firstFailed = r.checks.find((c) => !c.passed);
          return firstFailed ? (FIELD_LABELS[firstFailed.field] ?? firstFailed.field) : "Other";
        })();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// Only overrides that actually changed the outcome are worth reporting — an
// override that agrees with the rules moved nobody.
function countOverridden(results: EvalResult[]): number {
  return results.filter((r) => r.overridden && r.eligible !== r.ruleEligible).length;
}

export function EligibilityPanel({
  driveId,
  rules,
  latestSnapshot,
  skills,
}: {
  driveId: string;
  rules: Rule[];
  latestSnapshot: { studentCount: number; eligibleCount: number; overrideAdjustedCount: number } | null;
  skills: Skill[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ totalEvaluated: number; eligibleCount: number; notEligibleCount: number; results: EvalResult[] } | null>(null);
  const [draftRuleId, setDraftRuleId] = useState<string | null>(null);
  const [requiredSkillIds, setRequiredSkillIds] = useState<string[]>([]);

  function toggleSkill(id: string) {
    setRequiredSkillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreateAndPreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      minCgpa: fd.get("minCgpa") || undefined,
      maxActiveBacklogs: fd.get("maxActiveBacklogs") || undefined,
      minTenth: fd.get("minTenth") || undefined,
      minTwelfth: fd.get("minTwelfth") || undefined,
      minDiploma: fd.get("minDiploma") || undefined,
      maxClosedBacklogs: fd.get("maxClosedBacklogs") || undefined,
      requiredSkillIds: requiredSkillIds.length > 0 ? requiredSkillIds : undefined,
      requireExperience: fd.get("requireExperience") === "on" ? true : undefined,
      requireCertification: fd.get("requireCertification") === "on" ? true : undefined,
    };

    const createRes = await fetch(`/api/drives/${driveId}/eligibility/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      toast.error("Couldn't create rule.");
      setPending(false);
      return;
    }
    setDraftRuleId(created.id);

    const previewRes = await fetch(`/api/drives/${driveId}/eligibility/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: created.id }),
    });
    const previewData = await previewRes.json();
    setPending(false);
    if (previewRes.ok) {
      setPreview(previewData);
    } else {
      toast.error("Couldn't preview rule.");
    }
  }

  async function handlePublish(confirmed = false) {
    if (!draftRuleId) return;
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/eligibility/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: draftRuleId, confirmed }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (res.ok && data.needsConfirmation) {
      const ok = confirm(
        `${data.newlyIneligibleCount} of ${data.previouslyEligibleCount} previously-eligible students would become ineligible under this rule. Publish anyway?`,
      );
      if (ok) await handlePublish(true);
      return;
    }

    if (res.ok) {
      toast.success("Eligibility rule published and evaluated");
      setDraftRuleId(null);
      setPreview(null);
      router.refresh();
    } else {
      toast.error("Couldn't publish rule.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {latestSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current published eligibility</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Even columns rather than gap-6 — three stats of differing
                label width were bunching to the left with dead space beside
                them, and "Not eligible" was only inferable by subtraction. */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Evaluated</span>
                <span className="text-2xl font-semibold tabular-nums">{latestSnapshot.studentCount}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Eligible</span>
                <span className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {latestSnapshot.eligibleCount}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Not eligible</span>
                <span className="text-destructive text-2xl font-semibold tabular-nums">
                  {latestSnapshot.studentCount - latestSnapshot.eligibleCount}
                </span>
              </div>
            </div>
            {latestSnapshot.overrideAdjustedCount > 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                Includes {latestSnapshot.overrideAdjustedCount} verdict
                {latestSnapshot.overrideAdjustedCount === 1 ? "" : "s"} changed by a manual override.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Author a new rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAndPreview} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minCgpa">Minimum CGPA</Label>
                <Input id="minCgpa" name="minCgpa" type="number" step="0.1" min={0} max={10} placeholder="7.0" className="w-32" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxActiveBacklogs">Max active backlogs</Label>
                <Input id="maxActiveBacklogs" name="maxActiveBacklogs" type="number" min={0} defaultValue={0} className="w-32" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxClosedBacklogs">Max historical backlogs</Label>
                <Input id="maxClosedBacklogs" name="maxClosedBacklogs" type="number" min={0} placeholder="No limit" className="w-32" />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minTenth">Min 10th %</Label>
                <Input id="minTenth" name="minTenth" type="number" step="0.1" min={0} max={100} placeholder="60" className="w-32" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minTwelfth">Min 12th %</Label>
                <Input id="minTwelfth" name="minTwelfth" type="number" step="0.1" min={0} max={100} placeholder="60" className="w-32" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minDiploma">Min diploma %</Label>
                <Input id="minDiploma" name="minDiploma" type="number" step="0.1" min={0} max={100} placeholder="60" className="w-32" />
              </div>
            </div>

            {skills.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Required skills (any one of)</Label>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        requiredSkillIds.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="requireExperience" />
                Requires work experience on file
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="requireCertification" />
                Requires a certification on file
              </label>
            </div>

            <Button type="submit" disabled={pending} variant="outline" className="w-fit">
              Preview eligible population
            </Button>
          </form>

          {preview && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{preview.eligibleCount}</span> of{" "}
                  <span className="tabular-nums">{preview.totalEvaluated}</span> students would be eligible.
                  {countOverridden(preview.results) > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      Includes <span className="tabular-nums">{countOverridden(preview.results)}</span> changed by a manual
                      override.
                    </span>
                  )}
                </span>
                <Button size="sm" disabled={pending} onClick={() => handlePublish()}>
                  Publish this rule
                </Button>
              </div>
              {preview.notEligibleCount > 0 && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground mb-2">{preview.notEligibleCount} students excluded:</p>
                  <ul className="flex flex-col gap-1">
                    {summarizeExclusionReasons(preview.results).map((r) => (
                      <li key={r.label} className="flex items-center justify-between">
                        <span>{r.label}</span>
                        <span className="tabular-nums font-medium">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rule history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span>Version {r.version}</span>
                <span className="text-muted-foreground">{r.isPublished ? `Published ${new Date(r.publishedAt!).toLocaleDateString("en-IN")}` : "Draft"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
