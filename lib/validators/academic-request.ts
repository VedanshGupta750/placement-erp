import { z } from "zod";

// Only the fields that genuinely move during a degree. 10th/12th/diploma
// marks are fixed at admission, so allowing requests against them would be
// noise at best and a forgery surface at worst.
export const ACADEMIC_REQUEST_FIELDS = ["AGGREGATE", "LIVE_BACKLOGS", "CLOSED_BACKLOGS"] as const;
export type AcademicRequestField = (typeof ACADEMIC_REQUEST_FIELDS)[number];

export const ACADEMIC_FIELD_LABELS: Record<AcademicRequestField, string> = {
  AGGREGATE: "CGPA / Aggregate",
  LIVE_BACKLOGS: "Live backlogs",
  CLOSED_BACKLOGS: "Dead (cleared) backlogs",
};

export const ACADEMIC_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUPERSEDED"] as const;
export type AcademicRequestStatus = (typeof ACADEMIC_REQUEST_STATUSES)[number];

// Bounds differ per field: a CGPA is 0–10, a backlog count is a whole
// number. Validating here keeps an impossible value out of the queue rather
// than leaving the reviewer to catch it.
export const createAcademicRequestSchema = z
  .object({
    field: z.enum(ACADEMIC_REQUEST_FIELDS),
    requestedValue: z.coerce.number(),
    reason: z.string().trim().min(10, "Explain the change in at least 10 characters."),
  })
  .superRefine((v, ctx) => {
    if (v.field === "AGGREGATE") {
      if (v.requestedValue < 0 || v.requestedValue > 10) {
        ctx.addIssue({ code: "custom", path: ["requestedValue"], message: "CGPA must be between 0 and 10." });
      }
      return;
    }
    if (!Number.isInteger(v.requestedValue) || v.requestedValue < 0) {
      ctx.addIssue({ code: "custom", path: ["requestedValue"], message: "Backlog count must be a whole number, 0 or more." });
    }
    if (v.requestedValue > 100) {
      ctx.addIssue({ code: "custom", path: ["requestedValue"], message: "That backlog count looks wrong — check it." });
    }
  });
export type CreateAcademicRequestInput = z.infer<typeof createAcademicRequestSchema>;

export const reviewAcademicRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(500).optional(),
});
export type ReviewAcademicRequestInput = z.infer<typeof reviewAcademicRequestSchema>;

/** The Student column each request field writes to on approval. */
export const ACADEMIC_FIELD_COLUMN: Record<AcademicRequestField, "aggregate" | "liveBacklogs" | "closedBacklogs"> = {
  AGGREGATE: "aggregate",
  LIVE_BACKLOGS: "liveBacklogs",
  CLOSED_BACKLOGS: "closedBacklogs",
};
