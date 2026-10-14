// Single source of truth for "is this student placed?".
//
// PLACED IS A DECISION, NOT AN INFERENCE
// --------------------------------------
// It used to be derived: any accepted offer made a student placed. That was
// wrong in both directions. A student can hold an off-campus internship and
// still be very much on the market, and a college often knows a placement is
// real before any row in this system says so.
//
// So `Student.placementConfirmedAt` is the answer, and a human sets it.
// Offers and off-campus records are *evidence* — they surface on the profile
// and prompt staff to confirm — but nothing marks a student placed on its
// own. One consequence worth stating plainly: until someone confirms, the
// student keeps applying to drives, which is the behaviour a placement cell
// actually wants.
//
// Student.placementStatus (SEEKING / NOT_INTERESTED / OPTED_OUT) still
// carries the student's own intent; PLACED is no longer read from it,
// because that column was never written back reliably.

export const PLACED_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"] as const;

/** Off-campus records that count as evidence worth surfacing. */
export const COUNTED_OFF_CAMPUS_STATUS = "VERIFIED" as const;

// Not `as const`: Prisma's generated Exact<> input types reject readonly
// arrays, so these stay mutable object literals.

/** Prisma `where` fragment: students a human has confirmed as placed. */
export const placedStudentWhere = { placementConfirmedAt: { not: null } };

/** Prisma `where` fragment: students not yet confirmed placed. */
export const notPlacedStudentWhere = { placementConfirmedAt: null };

/**
 * Folds a fragment into a `where` that may already carry its own `OR` (a
 * text search) or `AND`. The placed fragments above are single-key today,
 * but they were not always, and `Object.assign` silently ate a search `OR`
 * the last time they changed shape. Mutates and returns the object.
 */
export function andStudentWhere(
  where: Record<string, unknown>,
  fragment: Record<string, unknown>,
): Record<string, unknown> {
  const existing = (where.AND as Record<string, unknown>[] | undefined) ?? [];
  where.AND = [...existing, fragment];
  return where;
}

/**
 * Relations worth fetching alongside a student to show what evidence exists
 * — an accepted offer or a verified off-campus record. These no longer
 * decide placement; they drive the "confirm this?" prompt on the profile.
 */
export const placementEvidenceSelect = {
  offers: { where: { status: { in: [...PLACED_OFFER_STATUSES] } }, select: { id: true }, take: 1 },
  offCampusPlacements: { where: { status: COUNTED_OFF_CAMPUS_STATUS }, select: { id: true }, take: 1 },
};

/** True when the student holds evidence of a placement nobody has confirmed. */
export function hasUnconfirmedEvidence(student: {
  placementConfirmedAt?: Date | string | null;
  offers?: { id: string }[];
  offCampusPlacements?: { id: string }[];
}): boolean {
  if (student.placementConfirmedAt) return false;
  return (student.offers?.length ?? 0) > 0 || (student.offCampusPlacements?.length ?? 0) > 0;
}

export type PlacementStatus = "SEEKING" | "PLACED" | "NOT_INTERESTED" | "OPTED_OUT";

export const PLACEMENT_STATUS_LABELS: Record<string, string> = {
  SEEKING: "Seeking",
  PLACED: "Placed",
  NOT_INTERESTED: "Not interested",
  OPTED_OUT: "Opted out",
};

/**
 * The status to show for a student. A confirmed placement wins; otherwise
 * the student's own declared intent stands. A stored "PLACED" that nobody
 * confirmed is reported as SEEKING rather than trusted.
 */
export function effectivePlacementStatus(stored: string, confirmedPlaced: boolean): PlacementStatus {
  if (confirmedPlaced) return "PLACED";
  if (stored === "PLACED") return "SEEKING";
  return (stored as PlacementStatus) ?? "SEEKING";
}

/**
 * Prisma `where` fragment for the roster's off-campus filter. Independent of
 * placement now: a student can hold an off-campus internship and not be
 * placed, which is exactly the case this filter exists to find.
 */
export function offCampusStudentWhere(value: string): Record<string, unknown> | null {
  if (value === "none") {
    return { offCampusPlacements: { none: { status: COUNTED_OFF_CAMPUS_STATUS } } };
  }
  if (value === "any") {
    return { offCampusPlacements: { some: { status: COUNTED_OFF_CAMPUS_STATUS } } };
  }
  if (value === "JOB" || value === "INTERNSHIP") {
    return { offCampusPlacements: { some: { status: COUNTED_OFF_CAMPUS_STATUS, placementType: value } } };
  }
  return null;
}
