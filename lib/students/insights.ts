// Placement Readiness Score and "Needs Attention" risk signals — both
// computed live from existing data on every read, never persisted. Same
// rationale as lib/events/status.ts's deriveEventStatus: no background job
// runner in this app, so a stored score would silently go stale the moment
// nobody happens to recompute it. These are advisory signals for a TPO, not
// verdicts — keep the reasoning transparent (a list of factors, not just a
// number) so "why is this student flagged" is always answerable.

export type ReadinessInput = {
  aggregate: number | null;
  liveBacklogs: number;
  resumeCount: number;
  skillCount: number;
  applicationCount: number;
  interviewCount: number;
};

export type ReadinessBreakdown = {
  academic: number;
  resume: number;
  skills: number;
  applications: number;
  interviewReadiness: number;
};

export function computeReadinessScore(input: ReadinessInput): { score: number; breakdown: ReadinessBreakdown } {
  const academic = input.aggregate == null ? 40 : Math.max(0, Math.min(100, Math.round((input.aggregate / 10) * 100) - input.liveBacklogs * 10));
  const resume = input.resumeCount > 0 ? 90 : 30;
  const skills = Math.max(0, Math.min(100, input.skillCount * 12));
  const applications = Math.max(0, Math.min(100, input.applicationCount * 15));
  const interviewReadiness = Math.max(0, Math.min(100, 40 + input.interviewCount * 15));

  const breakdown: ReadinessBreakdown = { academic, resume, skills, applications, interviewReadiness };
  const score = Math.round((academic + resume + skills + applications + interviewReadiness) / 5);
  return { score, breakdown };
}

export type RiskInput = {
  eligibleForPlacements: boolean;
  placementStatus: string;
  applicationCount: number;
  liveBacklogs: number;
  resumeCount: number;
  lastActivityAt: Date | null;
  aggregate: number | null;
};

export type RiskSignal = { label: string; severity: "warning" | "info" };

// Returns the list of concrete, actionable signals — never a single
// "at risk: yes/no" verdict. A TPO decides what to do; this only surfaces
// why a student might need a look.
export function computeRiskSignals(input: RiskInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (input.placementStatus === "PLACED") return signals;
  if (!input.eligibleForPlacements) return signals;

  if (input.applicationCount === 0) signals.push({ label: "No applications submitted yet", severity: "warning" });
  if (input.resumeCount === 0) signals.push({ label: "No resume uploaded", severity: "warning" });
  if (input.liveBacklogs > 0) signals.push({ label: `${input.liveBacklogs} active backlog${input.liveBacklogs === 1 ? "" : "s"}`, severity: "info" });
  if (input.aggregate != null && input.aggregate < 6) signals.push({ label: `Low CGPA (${input.aggregate})`, severity: "warning" });
  if (input.lastActivityAt) {
    const daysSince = Math.floor((Date.now() - input.lastActivityAt.getTime()) / 86400000);
    if (daysSince > 30) signals.push({ label: `No activity in ${daysSince} days`, severity: "warning" });
  }

  return signals;
}
