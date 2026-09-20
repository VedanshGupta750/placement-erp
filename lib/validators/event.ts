import { z } from "zod";

const EVENT_CATEGORIES = [
  "EXPERT_SESSION",
  "WORKSHOP",
  "COMPETITION",
  "HACKATHON",
  "WEBINAR",
  "CAREER_FAIR",
  "PRE_PLACEMENT_TALK",
  "ASSESSMENT",
  "TRAINING",
  "ALUMNI_SESSION",
  "COMPANY_SESSION",
  "GENERAL",
] as const;

export const createEventSchema = z.object({
  category: z.enum(EVENT_CATEGORIES),
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  description: z.string().trim().min(1, "Description can't be empty."),
  organizerLabel: z.string().trim().optional(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).default("OFFLINE"),
  venue: z.string().trim().optional(),
  meetingUrl: z.string().trim().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  registrationOpensAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  approvalRequired: z.boolean().optional(),
  eligibleBatchIds: z.array(z.string()).optional(),
  eligibleDepartmentIds: z.array(z.string()).optional(),
  speakerId: z.string().optional(),
  companyId: z.string().optional(),
  driveId: z.string().optional(),
  certificateEnabled: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
  // When true, the created event is published immediately (publishedAt =
  // now) instead of saved as a draft — the wizard's "Publish" button on
  // create. Editing an already-created event's publish state goes through
  // PATCH /api/events/[id] with {action:"publish"|"cancel"} instead.
  publish: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

// Same field set as createEventSchema minus `category`/`title`/`description`
// being required — PATCH supports partial updates (the wizard always sends
// the full form, but this keeps the route usable for smaller field patches
// too).
export const updateEventSchema = z.object({
  category: z.enum(EVENT_CATEGORIES).optional(),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").optional(),
  description: z.string().trim().min(1, "Description can't be empty.").optional(),
  organizerLabel: z.string().trim().optional().nullable(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
  venue: z.string().trim().optional().nullable(),
  meetingUrl: z.string().trim().optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  registrationOpensAt: z.string().optional().nullable(),
  registrationClosesAt: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  approvalRequired: z.boolean().optional(),
  eligibleBatchIds: z.array(z.string()).optional(),
  eligibleDepartmentIds: z.array(z.string()).optional(),
  speakerId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  driveId: z.string().optional().nullable(),
  certificateEnabled: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
