"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

const RECOMMENDATIONS = [
  { value: "STRONG_HIRE", label: "Strong Hire" },
  { value: "HIRE", label: "Hire" },
  { value: "HOLD", label: "Hold" },
  { value: "REJECT", label: "Reject" },
];

type Criterion = { key: string; label: string };

export function EvaluateDialog({
  open,
  onOpenChange,
  candidateId,
  roundType,
  initialCriteriaScores,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  roundType?: string;
  initialCriteriaScores?: Record<string, number> | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"PASSED" | "FAILED">("PASSED");
  const [score, setScore] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [feedback, setFeedback] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, string>>({});

  // Fetch the round's scorecard template, if one has been set up for this
  // roundType — rounds without a template just keep the plain overall
  // score field, no fake criteria invented for them.
  useEffect(() => {
    if (!open || !roundType) return;
    setCriteria(null);
    fetch(`/api/scorecard-templates?roundType=${encodeURIComponent(roundType)}`)
      .then((r) => r.json())
      .then((data) => {
        const template = data.templates?.[0];
        if (template) {
          setCriteria(template.criteria);
          const seed: Record<string, string> = {};
          for (const c of template.criteria as Criterion[]) {
            seed[c.key] = initialCriteriaScores?.[c.key] != null ? String(initialCriteriaScores[c.key]) : "";
          }
          setCriteriaScores(seed);
        } else {
          setCriteria([]);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roundType]);

  const usingTemplate = criteria !== null && criteria.length > 0;
  const criteriaValues = Object.values(criteriaScores).map(Number).filter((n) => !Number.isNaN(n));
  const computedScore = criteriaValues.length > 0 ? Math.round((criteriaValues.reduce((s, v) => s + v, 0) / criteriaValues.length) * 10) : null;

  async function submit() {
    setPending(true);
    const payload: Record<string, unknown> = {
      action: "score",
      result,
      strengths: strengths || undefined,
      weaknesses: weaknesses || undefined,
      feedback: feedback || undefined,
      recommendation: recommendation || undefined,
    };
    if (usingTemplate) {
      const scores: Record<string, number> = {};
      for (const c of criteria!) {
        const v = Number(criteriaScores[c.key]);
        if (!Number.isNaN(v)) scores[c.key] = v;
      }
      payload.criteriaScores = scores;
    } else {
      payload.score = score || undefined;
    }
    const res = await fetch(`/api/round-candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Evaluation saved.");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't save evaluation.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Evaluate interview</DialogTitle></DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label>Result</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={result === "PASSED" ? "default" : "outline"} onClick={() => setResult("PASSED")}>Passed</Button>
              <Button type="button" size="sm" variant={result === "FAILED" ? "default" : "outline"} onClick={() => setResult("FAILED")}>Failed</Button>
            </div>
          </div>

          {usingTemplate ? (
            <div className="flex flex-col gap-2">
              <Label>Scorecard</Label>
              {criteria!.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{c.label}</span>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    className="w-20"
                    value={criteriaScores[c.key] ?? ""}
                    onChange={(e) => setCriteriaScores((prev) => ({ ...prev, [c.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-sm">
                <span>Overall (auto)</span>
                <span className="font-semibold tabular-nums">{computedScore !== null ? `${computedScore}/100` : "-"}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="score">Score (0–100)</Label>
              <Input id="score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Strengths</Label>
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Weaknesses</Label>
            <Textarea value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes / feedback</Label>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Recommendation</Label>
            <Select value={recommendation} onValueChange={(v) => v && setRecommendation(v)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {RECOMMENDATIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending} onClick={submit}>{pending ? "Saving…" : "Save evaluation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
