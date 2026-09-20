"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EvaluateDialog } from "@/components/interviews/evaluate-dialog";

const RECOMMENDATION_LABEL: Record<string, string> = {
  STRONG_HIRE: "Strong Hire",
  HIRE: "Hire",
  HOLD: "Hold",
  REJECT: "Reject",
};

type Evaluation = {
  status: string;
  score: number | null;
  strengths: string | null;
  weaknesses: string | null;
  feedback: string | null;
  recommendation: string | null;
  criteriaScores: Record<string, number> | null;
};

export function InterviewEvaluationPanel({
  candidateId,
  roundType,
  evaluation,
  canEvaluate,
  criteriaLabels,
}: {
  candidateId: string;
  roundType: string;
  evaluation: Evaluation;
  canEvaluate: boolean;
  criteriaLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const evaluated = ["PASSED", "FAILED"].includes(evaluation.status);

  if (!evaluated) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Evaluation</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-muted-foreground text-sm">
            {evaluation.status === "COMPLETED" ? "Interview complete — pending evaluation." : "Not evaluated yet."}
          </p>
          {canEvaluate && <Button size="sm" onClick={() => setOpen(true)}>Evaluate now</Button>}
        </CardContent>
        <EvaluateDialog open={open} onOpenChange={setOpen} candidateId={candidateId} roundType={roundType} initialCriteriaScores={evaluation.criteriaScores} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Evaluation</CardTitle>
        {canEvaluate && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Edit</Button>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold tabular-nums">{evaluation.score !== null ? `${evaluation.score}/100` : "-"}</span>
          <StatusBadge status={evaluation.status} />
        </div>
        {evaluation.criteriaScores && Object.keys(evaluation.criteriaScores).length > 0 && (
          <div className="flex flex-col gap-1 border-t pt-2">
            {Object.entries(evaluation.criteriaScores).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{criteriaLabels[key] ?? key}</span>
                <span className="tabular-nums">{val}/10</span>
              </div>
            ))}
          </div>
        )}
        {evaluation.recommendation && (
          <div><span className="text-muted-foreground">Recommendation: </span><span className="font-medium">{RECOMMENDATION_LABEL[evaluation.recommendation] ?? evaluation.recommendation}</span></div>
        )}
        {evaluation.strengths && <div><div className="text-muted-foreground text-xs">Strengths</div><p>{evaluation.strengths}</p></div>}
        {evaluation.weaknesses && <div><div className="text-muted-foreground text-xs">Weaknesses</div><p>{evaluation.weaknesses}</p></div>}
        {evaluation.feedback && <div><div className="text-muted-foreground text-xs">Notes</div><p>{evaluation.feedback}</p></div>}
      </CardContent>
      <EvaluateDialog open={open} onOpenChange={setOpen} candidateId={candidateId} roundType={roundType} initialCriteriaScores={evaluation.criteriaScores} />
    </Card>
  );
}
