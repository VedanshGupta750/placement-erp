// Deterministic, rules-based drive health signals — same "system-generated
// indicator computed from real, queryable signals" contract as
// lib/companies/health-score.ts and lib/contacts/relationship-score.ts.
// Deliberately not an LLM call: every signal here is a plain threshold over
// real counts, cheap enough to compute on every render and fully
// explainable (no "why did it say that" ambiguity a generated summary
// would have).
export type DriveHealthSignal = { tone: "positive" | "warning"; text: string };

export function computeDriveHealthSignals(input: {
  eligibleCount: number;
  applications: number;
  shortlisted: number;
  interviewSlotsScheduled: number;
  offers: number;
  daysUntilRegistrationCloses: number | null;
}): { score: number; signals: DriveHealthSignal[] } {
  const signals: DriveHealthSignal[] = [];
  let score = 100;

  const applicationRate = input.eligibleCount > 0 ? input.applications / input.eligibleCount : 0;
  if (input.eligibleCount > 0 && applicationRate >= 0.5) {
    signals.push({ tone: "positive", text: `Strong applications — ${Math.round(applicationRate * 100)}% of the eligible pool has applied.` });
  } else if (input.eligibleCount > 0 && applicationRate < 0.2) {
    signals.push({ tone: "warning", text: `${input.eligibleCount - input.applications} eligible students haven't applied yet.` });
    score -= 20;
  }

  if (input.eligibleCount > 0) {
    signals.push({ tone: "positive", text: `Eligible pool of ${input.eligibleCount} students to draw from.` });
  } else {
    signals.push({ tone: "warning", text: "No eligible students — check the eligibility rule and batch scope." });
    score -= 30;
  }

  if (input.applications > 0 && input.shortlisted === 0) {
    signals.push({ tone: "warning", text: "Applications received but none shortlisted yet." });
    score -= 10;
  }

  if (input.shortlisted > 0 && input.interviewSlotsScheduled < input.shortlisted) {
    signals.push({ tone: "warning", text: `Interview capacity is low — ${input.shortlisted} shortlisted but only ${input.interviewSlotsScheduled} interview slots scheduled.` });
    score -= 15;
  }

  if (input.daysUntilRegistrationCloses != null && input.daysUntilRegistrationCloses >= 0 && input.daysUntilRegistrationCloses <= 2 && applicationRate < 0.5) {
    signals.push({ tone: "warning", text: `Registration closes in ${input.daysUntilRegistrationCloses} day${input.daysUntilRegistrationCloses === 1 ? "" : "s"} with applications still under 50% of the eligible pool.` });
    score -= 15;
  }

  if (input.offers > 0) {
    signals.push({ tone: "positive", text: `${input.offers} offer${input.offers === 1 ? "" : "s"} made so far.` });
  }

  return { score: Math.max(0, Math.min(100, score)), signals };
}
