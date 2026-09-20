import { z } from "zod";

// Fixed option lists — single source of truth for both the Zod validators
// below and any <Select> built against them, so the UI and the API can
// never drift apart on what's a valid value.
export const CONTACT_TYPES = [
  "Campus Recruiter",
  "HR",
  "Talent Acquisition",
  "Hiring Manager",
  "Technical Interviewer",
  "Recruitment Agency",
  "Founder",
  "HR Head",
  "University Relations",
  "Alumni Recruiter",
  "Other",
] as const;

export const RELATIONSHIP_STAGES = [
  "NEW",
  "CONTACTED",
  "ENGAGED",
  "HIRING_DISCUSSION",
  "ACTIVE_RECRUITER",
  "REPEAT_PARTNER",
  "DORMANT",
] as const;

export const RELATIONSHIP_STAGE_LABELS: Record<(typeof RELATIONSHIP_STAGES)[number], string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  ENGAGED: "Engaged",
  HIRING_DISCUSSION: "Hiring Discussion",
  ACTIVE_RECRUITER: "Active Recruiter",
  REPEAT_PARTNER: "Repeat Partner",
  DORMANT: "Dormant",
};

export const createContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  contactType: z.enum(CONTACT_TYPES).optional(),
  companyId: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  location: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  relationshipStage: z.enum(RELATIONSHIP_STAGES).optional(),
  ownerId: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const logCommunicationSchema = z.object({
  type: z.enum(["EMAIL_SENT", "EMAIL_RECEIVED", "CALL", "MEETING", "NOTE", "MESSAGE"]),
  subject: z.string().trim().optional(),
  body: z.string().trim().optional(),
  occurredAt: z.string().optional(),
});
export type LogCommunicationInput = z.infer<typeof logCommunicationSchema>;

export const createContactNoteSchema = z.object({
  body: z.string().trim().min(1, "Note can't be empty."),
});
export type CreateContactNoteInput = z.infer<typeof createContactNoteSchema>;

export const setFollowUpSchema = z.object({
  nextFollowUpAt: z
    .string()
    .min(1, "Pick a date.")
    .refine((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
    }, "Enter a valid follow-up date."),
  nextFollowUpNote: z.string().trim().optional(),
});
export type SetFollowUpInput = z.infer<typeof setFollowUpSchema>;

export const bulkUpdateContactsSchema = z.object({
  contactIds: z.array(z.string().trim().min(1)).min(1, "Select at least one contact."),
  action: z.enum(["assign_owner", "set_stage", "add_tag"]),
  value: z.string().trim(),
});
export type BulkUpdateContactsInput = z.infer<typeof bulkUpdateContactsSchema>;
