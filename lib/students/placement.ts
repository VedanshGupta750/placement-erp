// Single source of truth for "is this student placed?".
//
// Student.placementStatus stores four states — SEEKING / PLACED /
// NOT_INTERESTED / OPTED_OUT — but only three of them are things a human
// declares. PLACED is a *consequence* of an offer, and nothing in the offer
// lifecycle ever wrote it back, so the column sat at SEEKING for students
// who had actually joined a company: the Students page read 0 placed while
// the Overview (which derives from offers) read 3.
//
// So: PLACED is always derived from offers and never trusted from the
// column; the other three are read from the column, because no offer row
// can tell you a student opted out. lib/dashboard/get-stat-cards.ts and
// lib/network/placement-status.ts already use this same offer-status set —
// this just names it once so the three can't drift apart again.

export const PLACED_OFFER_STATUSES = ["ACCEPTED", "JOINING_PENDING", "JOINED"] as const;

// Not `as const`: Prisma's generated Exact<> input types reject readonly
// arrays, so these stay mutable object literals.
/** Prisma `where` fragment: students holding at least one placing offer. */
export const placedStudentWhere = {
  offers: { some: { status: { in: [...PLACED_OFFER_STATUSES] } } },
};

/** Prisma `where` fragment: students holding no placing offer. */
export const notPlacedStudentWhere = {
  offers: { none: { status: { in: [...PLACED_OFFER_STATUSES] } } },
};

export type PlacementStatus = "SEEKING" | "PLACED" | "NOT_INTERESTED" | "OPTED_OUT";

export const PLACEMENT_STATUS_LABELS: Record<string, string> = {
  SEEKING: "Seeking",
  PLACED: "Placed",
  NOT_INTERESTED: "Not interested",
  OPTED_OUT: "Opted out",
};

/**
 * The status to show for a student. An accepted/joined offer always wins —
 * a placed student is placed regardless of what the column says — otherwise
 * the stored, human-set value stands. Never returns a stored "PLACED" that
 * isn't backed by an offer, so a stale column can't misreport either way.
 */
export function effectivePlacementStatus(stored: string, hasPlacingOffer: boolean): PlacementStatus {
  if (hasPlacingOffer) return "PLACED";
  if (stored === "PLACED") return "SEEKING";
  return (stored as PlacementStatus) ?? "SEEKING";
}
