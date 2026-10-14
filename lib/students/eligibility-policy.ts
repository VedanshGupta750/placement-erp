// College-wide placement eligibility, set by the TPO under Settings.
//
// THE PROBLEM THIS SOLVES
// -----------------------
// The roster's "Status" column used to read Student.eligibleForPlacements
// directly, and that column defaults to true. So a student with a live
// backlog and a 6.1 CGPA showed "Eligible", and the CGPA / 10th / 12th /
// Backlogs columns printed right next to it fed into nothing at all. The
// only way the badge ever said otherwise was a human unticking a box.
//
// HOW THE TWO LAYERS COMBINE
// --------------------------
// `eligibleForPlacements = false` is a hard block and always wins: it means
// a staff member deliberately excluded this student, and no policy should
// quietly re-admit them.
//
// `eligibleForPlacements = true` means "not blocked" — the policy then
// decides, if one is enabled. With the policy off (the default), true keeps
// meaning plain "eligible", so existing colleges behave exactly as before
// until a TPO turns it on.
//
// That gives the TPO a rule without taking away the per-student override,
// and needs no extra column to tell "never touched" from "deliberately
// allowed" — because both should defer to the policy anyway.

export type EligibilityPolicy = {
  enabled: boolean;
  minCgpa: number | null;
  maxLiveBacklogs: number | null;
  minTenthScore: number | null;
  minTwelfthScore: number | null;
  requireAcademics: boolean;
};

export type PolicyStudentFacts = {
  eligibleForPlacements: boolean;
  aggregate: number | null;
  liveBacklogs: number;
  tenthScore: number | null;
  twelfthScore: number | null;
};

export type EligibilityVerdict = {
  eligible: boolean;
  /** Why not — empty when eligible. Plain language, for a tooltip. */
  reasons: string[];
  /** What decided it, so the UI can say "blocked by staff" vs "below policy". */
  source: "blocked" | "policy" | "flag";
};

/** Reads the policy off a College row (or anything with those columns). */
export function readEligibilityPolicy(college: {
  eligibilityPolicyEnabled: boolean;
  eligibilityMinCgpa: number | null;
  eligibilityMaxLiveBacklogs: number | null;
  eligibilityMinTenthScore: number | null;
  eligibilityMinTwelfthScore: number | null;
  eligibilityRequireAcademics: boolean;
}): EligibilityPolicy {
  return {
    enabled: college.eligibilityPolicyEnabled,
    minCgpa: college.eligibilityMinCgpa,
    maxLiveBacklogs: college.eligibilityMaxLiveBacklogs,
    minTenthScore: college.eligibilityMinTenthScore,
    minTwelfthScore: college.eligibilityMinTwelfthScore,
    requireAcademics: college.eligibilityRequireAcademics,
  };
}

export const EMPTY_POLICY: EligibilityPolicy = {
  enabled: false,
  minCgpa: null,
  maxLiveBacklogs: null,
  minTenthScore: null,
  minTwelfthScore: null,
  requireAcademics: false,
};

/** True when the policy is on but has no thresholds — it would pass everyone. */
export function policyHasNoRules(policy: EligibilityPolicy): boolean {
  return (
    policy.minCgpa === null &&
    policy.maxLiveBacklogs === null &&
    policy.minTenthScore === null &&
    policy.minTwelfthScore === null &&
    !policy.requireAcademics
  );
}

export function evaluateStudentEligibility(
  policy: EligibilityPolicy,
  student: PolicyStudentFacts,
): EligibilityVerdict {
  if (!student.eligibleForPlacements) {
    return { eligible: false, reasons: ["Excluded by the placement cell."], source: "blocked" };
  }
  if (!policy.enabled) {
    return { eligible: true, reasons: [], source: "flag" };
  }

  const reasons: string[] = [];

  // A missing score is only a failure when requireAcademics is on. Otherwise
  // a student whose results aren't published yet is left alone rather than
  // being silently marked ineligible for a figure nobody has entered.
  const check = (value: number | null, fail: (v: number) => boolean, missing: string, failed: (v: number) => string) => {
    if (value === null) {
      if (policy.requireAcademics) reasons.push(missing);
      return;
    }
    if (fail(value)) reasons.push(failed(value));
  };

  if (policy.minCgpa !== null) {
    check(
      student.aggregate,
      (v) => v < policy.minCgpa!,
      "No CGPA on file.",
      (v) => `CGPA ${v} is below the required ${policy.minCgpa}.`,
    );
  }
  if (policy.minTenthScore !== null) {
    check(
      student.tenthScore,
      (v) => v < policy.minTenthScore!,
      "No 10th % on file.",
      (v) => `10th ${v}% is below the required ${policy.minTenthScore}%.`,
    );
  }
  if (policy.minTwelfthScore !== null) {
    check(
      student.twelfthScore,
      (v) => v < policy.minTwelfthScore!,
      "No 12th % on file.",
      (v) => `12th ${v}% is below the required ${policy.minTwelfthScore}%.`,
    );
  }
  // liveBacklogs is a non-null Int column, so it needs no missing-value path.
  if (policy.maxLiveBacklogs !== null && student.liveBacklogs > policy.maxLiveBacklogs) {
    reasons.push(
      policy.maxLiveBacklogs === 0
        ? `${student.liveBacklogs} live backlog${student.liveBacklogs === 1 ? "" : "s"} — none are allowed.`
        : `${student.liveBacklogs} live backlogs exceed the limit of ${policy.maxLiveBacklogs}.`,
    );
  }

  return { eligible: reasons.length === 0, reasons, source: "policy" };
}

/**
 * Prisma `where` fragment matching exactly the students the evaluator would
 * call eligible. Kept beside the evaluator so the roster badge, the "Eligible"
 * KPI, the tab filter and the forecast denominator can never drift apart —
 * they all have to mean the same thing or the page contradicts itself.
 */
export function eligibleStudentWhere(policy: EligibilityPolicy): Record<string, unknown> {
  if (!policy.enabled) return { eligibleForPlacements: true };

  const and: Record<string, unknown>[] = [{ eligibleForPlacements: true }];
  const numeric = (field: string, threshold: number | null, op: "gte" | "lte") => {
    if (threshold === null) return;
    and.push(
      policy.requireAcademics
        ? { [field]: { [op]: threshold } }
        : { OR: [{ [field]: null }, { [field]: { [op]: threshold } }] },
    );
  };

  numeric("aggregate", policy.minCgpa, "gte");
  numeric("tenthScore", policy.minTenthScore, "gte");
  numeric("twelfthScore", policy.minTwelfthScore, "gte");
  if (policy.maxLiveBacklogs !== null) and.push({ liveBacklogs: { lte: policy.maxLiveBacklogs } });

  // requireAcademics also means "a missing figure is a failure", including
  // for thresholds that aren't set — mirrors the evaluator, which only
  // reports a missing value for fields the policy actually checks.
  return { AND: and };
}
