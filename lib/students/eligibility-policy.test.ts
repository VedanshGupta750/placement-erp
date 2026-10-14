import { describe, it, expect } from "vitest";
import {
  evaluateStudentEligibility,
  eligibleStudentWhere,
  policyHasNoRules,
  EMPTY_POLICY,
  type EligibilityPolicy,
  type PolicyStudentFacts,
} from "./eligibility-policy";

const policy = (over: Partial<EligibilityPolicy> = {}): EligibilityPolicy => ({
  ...EMPTY_POLICY,
  enabled: true,
  ...over,
});

const student = (over: Partial<PolicyStudentFacts> = {}): PolicyStudentFacts => ({
  eligibleForPlacements: true,
  aggregate: 8,
  liveBacklogs: 0,
  tenthScore: 85,
  twelfthScore: 85,
  ...over,
});

describe("evaluateStudentEligibility", () => {
  it("treats a staff block as final, even when the student passes every threshold", () => {
    const v = evaluateStudentEligibility(policy({ minCgpa: 6 }), student({ eligibleForPlacements: false }));
    expect(v.eligible).toBe(false);
    expect(v.source).toBe("blocked");
  });

  it("falls back to the plain flag when no policy is enabled", () => {
    const v = evaluateStudentEligibility(EMPTY_POLICY, student({ aggregate: 2, liveBacklogs: 9 }));
    expect(v.eligible).toBe(true);
    expect(v.source).toBe("flag");
  });

  it("fails a student below the CGPA floor", () => {
    const v = evaluateStudentEligibility(policy({ minCgpa: 7.5 }), student({ aggregate: 7.06 }));
    expect(v.eligible).toBe(false);
    expect(v.reasons[0]).toContain("7.06");
  });

  // The case from the roster screenshot: 1 live backlog used to read "Eligible".
  it("fails a student with backlogs when none are allowed", () => {
    const v = evaluateStudentEligibility(policy({ maxLiveBacklogs: 0 }), student({ liveBacklogs: 1 }));
    expect(v.eligible).toBe(false);
    expect(v.reasons[0]).toContain("none are allowed");
  });

  it("allows backlogs up to the limit, and fails above it", () => {
    expect(evaluateStudentEligibility(policy({ maxLiveBacklogs: 2 }), student({ liveBacklogs: 2 })).eligible).toBe(true);
    expect(evaluateStudentEligibility(policy({ maxLiveBacklogs: 2 }), student({ liveBacklogs: 3 })).eligible).toBe(false);
  });

  it("leaves a student with no CGPA alone unless academics are required", () => {
    expect(evaluateStudentEligibility(policy({ minCgpa: 7 }), student({ aggregate: null })).eligible).toBe(true);
    expect(
      evaluateStudentEligibility(policy({ minCgpa: 7, requireAcademics: true }), student({ aggregate: null })).eligible,
    ).toBe(false);
  });

  it("only demands a figure the policy actually checks", () => {
    // requireAcademics is on but no 12th threshold is set, so a missing
    // 12th score must not fail the student.
    const v = evaluateStudentEligibility(
      policy({ minCgpa: 7, requireAcademics: true }),
      student({ twelfthScore: null }),
    );
    expect(v.eligible).toBe(true);
  });

  it("reports every failed threshold, not just the first", () => {
    const v = evaluateStudentEligibility(
      policy({ minCgpa: 8, minTenthScore: 90, maxLiveBacklogs: 0 }),
      student({ aggregate: 6, tenthScore: 70, liveBacklogs: 2 }),
    );
    expect(v.reasons).toHaveLength(3);
  });
});

describe("policyHasNoRules", () => {
  it("spots a policy that is switched on but would pass everyone", () => {
    expect(policyHasNoRules(policy())).toBe(true);
    expect(policyHasNoRules(policy({ minCgpa: 6 }))).toBe(false);
  });
});

// The evaluator renders the badge; the where-fragment drives the KPI count,
// the tab filter and the forecast denominator. If they ever disagree the page
// contradicts itself — "12 eligible" above a list showing 15 badges. These
// assert the shapes stay in step.
describe("eligibleStudentWhere", () => {
  it("is just the flag when the policy is off", () => {
    expect(eligibleStudentWhere(EMPTY_POLICY)).toEqual({ eligibleForPlacements: true });
  });

  it("always keeps the staff block in the query", () => {
    const where = eligibleStudentWhere(policy({ minCgpa: 7 })) as { AND: Record<string, unknown>[] };
    expect(where.AND[0]).toEqual({ eligibleForPlacements: true });
  });

  it("tolerates missing scores unless academics are required", () => {
    const lenient = eligibleStudentWhere(policy({ minCgpa: 7 })) as { AND: Record<string, unknown>[] };
    expect(lenient.AND).toContainEqual({ OR: [{ aggregate: null }, { aggregate: { gte: 7 } }] });

    const strict = eligibleStudentWhere(policy({ minCgpa: 7, requireAcademics: true })) as {
      AND: Record<string, unknown>[];
    };
    expect(strict.AND).toContainEqual({ aggregate: { gte: 7 } });
  });

  it("omits thresholds that aren't set", () => {
    const where = eligibleStudentWhere(policy({ maxLiveBacklogs: 0 })) as { AND: Record<string, unknown>[] };
    expect(where.AND).toEqual([{ eligibleForPlacements: true }, { liveBacklogs: { lte: 0 } }]);
  });
});
