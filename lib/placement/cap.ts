// The placement cap ("dream offer" rule): once a student is confirmed
// placed, which further drives may they still apply to?
//
// NOTHING HERE IS HARDCODED. The TPO chooses the MODE as well as the
// numbers under Settings, because colleges genuinely differ:
//
//   INCREMENT    the bar is the student's current package plus a fixed
//                step. A student on 6 LPA with a 4 LPA step can only chase
//                10 LPA and above. This is the rule most Indian campuses
//                use, and it is the default.
//   FIXED_FLOOR  one college-wide bar. "Placed students may only apply at
//                or above 10 LPA", whatever they currently hold.
//   MULTIPLIER   the bar is relative to what they already have. "The next
//                offer must beat the current one by 1.5x", so it rises
//                proportionally rather than by a flat step.
//
// On top of that, crossing between technical and non-technical work can
// carry its own rule — a CSE student who took a non-tech role is usually
// still allowed to chase a tech one, and most colleges set a softer bar for
// that case. Off by default, in which case one rule applies to everyone.
//
// Returning a reason, not just a boolean: "you can't apply" with no figure
// attached is the kind of wall that generates support tickets.

export type CapMode = "INCREMENT" | "FIXED_FLOOR" | "MULTIPLIER";

export type PlacementCapPolicy = {
  enabled: boolean;
  mode: CapMode;
  floor: number | null;
  multiplier: number | null;
  increment: number | null;
  crossEnabled: boolean;
  crossFloor: number | null;
  crossMultiplier: number | null;
  crossIncrement: number | null;
};

export type CapDecision = {
  allowed: boolean;
  /** Plain-language explanation, shown to the student. */
  reason?: string;
  /** The bar they had to clear, for the UI to display. */
  requiredCtc?: number;
};

const dec = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function readPlacementCapPolicy(college: {
  placementCapEnabled: boolean;
  placementCapMode: string;
  placementCapFloor: unknown;
  placementCapMultiplier: number | null;
  placementCapIncrement: unknown;
  placementCapCrossEnabled: boolean;
  placementCapCrossFloor: unknown;
  placementCapCrossMultiplier: number | null;
  placementCapCrossIncrement: unknown;
}): PlacementCapPolicy {
  return {
    enabled: college.placementCapEnabled,
    mode:
      college.placementCapMode === "MULTIPLIER"
        ? "MULTIPLIER"
        : college.placementCapMode === "FIXED_FLOOR"
          ? "FIXED_FLOOR"
          : "INCREMENT",
    floor: dec(college.placementCapFloor),
    multiplier: college.placementCapMultiplier ?? null,
    increment: dec(college.placementCapIncrement),
    crossEnabled: college.placementCapCrossEnabled,
    crossFloor: dec(college.placementCapCrossFloor),
    crossMultiplier: college.placementCapCrossMultiplier ?? null,
    crossIncrement: dec(college.placementCapCrossIncrement),
  };
}

export const EMPTY_CAP_POLICY: PlacementCapPolicy = {
  enabled: false,
  mode: "INCREMENT",
  floor: null,
  multiplier: null,
  increment: null,
  crossEnabled: false,
  crossFloor: null,
  crossMultiplier: null,
  crossIncrement: null,
};

const inr = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)}L` : `₹${n.toLocaleString("en-IN")}`;

/**
 * @param placed            Has a staff member confirmed this student placed?
 * @param currentCtc        Their best confirmed package, if known.
 * @param studentIsTechnical Course.isTechnical
 * @param existingIsTechnical Whether their CURRENT placement was technical work.
 * @param driveCtc          The drive they want to apply to, null if unstated.
 * @param driveIsTechnical  Drive.isTechnical
 */
export function evaluatePlacementCap(
  policy: PlacementCapPolicy,
  input: {
    placed: boolean;
    currentCtc: number | null;
    studentIsTechnical: boolean;
    existingIsTechnical: boolean | null;
    driveCtc: number | null;
    driveIsTechnical: boolean;
  },
): CapDecision {
  // An unplaced student is never capped — the rule is entirely about what
  // happens AFTER a placement is confirmed.
  if (!input.placed) return { allowed: true };

  if (!policy.enabled) {
    // Cap switched off means a confirmed placement blocks further applying
    // outright, which is the behaviour a placement cell expects by default.
    return {
      allowed: false,
      reason: "You are already placed, so you can't apply to further drives. Contact your placement cell if this is wrong.",
    };
  }

  // "Crossed over" means their existing placement sits on the other side of
  // the technical line from the student's own branch — a tech student in a
  // non-tech role, or the reverse. Judged against the branch, not against
  // the new drive, because the rule is about what they already took.
  const crossed =
    policy.crossEnabled &&
    input.existingIsTechnical !== null &&
    input.existingIsTechnical !== input.studentIsTechnical;

  const mode = policy.mode;
  const floor = crossed && policy.crossFloor !== null ? policy.crossFloor : policy.floor;
  const multiplier = crossed && policy.crossMultiplier !== null ? policy.crossMultiplier : policy.multiplier;
  const increment = crossed && policy.crossIncrement !== null ? policy.crossIncrement : policy.increment;

  let required: number | null = null;
  if (mode === "FIXED_FLOOR") {
    required = floor;
  } else if (mode === "MULTIPLIER") {
    if (multiplier !== null && input.currentCtc !== null) required = input.currentCtc * multiplier;
  } else if (increment !== null && input.currentCtc !== null) {
    // INCREMENT: 6 LPA held + a 4 LPA step = 10 LPA to apply.
    required = input.currentCtc + increment;
  }

  // A policy switched on but never filled in must not silently block
  // everyone — that reads as a broken app rather than a rule.
  if (required === null) {
    const relative = mode === "INCREMENT" || mode === "MULTIPLIER";
    return {
      allowed: false,
      reason:
        relative && input.currentCtc === null
          ? "You are already placed, but no package is recorded against that placement, so the limit can't be worked out. Ask your placement cell to add it."
          : "You are already placed. Your placement cell has turned on a cap but hasn't set the figure yet — please contact them.",
    };
  }

  if (input.driveCtc === null) {
    // No package on the drive means the bar can't be checked. Blocking is
    // the safe side of an unknown here: letting a placed student through a
    // cap the college set, because a figure is missing, is the worse error.
    return {
      allowed: false,
      reason: `You are already placed, and this drive hasn't published a package, so it can't be checked against the ${inr(required)} limit your placement cell has set.`,
      requiredCtc: required,
    };
  }

  if (input.driveCtc < required) {
    return {
      allowed: false,
      reason: `You are already placed${input.currentCtc !== null && mode !== "FIXED_FLOOR" ? ` at ${inr(input.currentCtc)}` : ""}. Your placement cell only allows further applications at ${inr(required)} or above${crossed ? " (the rate for a placement outside your branch's field)" : ""}, and this drive offers ${inr(input.driveCtc)}.`,
      requiredCtc: required,
    };
  }

  return { allowed: true, requiredCtc: required };
}
