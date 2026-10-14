import { z } from "zod";

export const createApplicationSchema = z.object({
  driveId: z.string().min(1, "Drive is required."),
  positionId: z.string().min(1, "Position is required."),
  // Required, not optional. A student applying with no resume gives the
  // recruiter nothing to screen, and the drive-wide resume ZIP download
  // silently skips them — so the application was effectively dead on
  // arrival. Staff-side routes (/api/applications/add,
  // /api/students/[id]/applications, the bulk add-to-drive action) keep
  // their own looser rules: a TPO adding a shortlisted set is an explicit
  // override and doesn't go through this schema.
  resumeId: z
    .string({ error: "Select a resume before applying." })
    .min(1, "Select a resume before applying."),
  fieldValues: z.array(z.object({ fieldId: z.string(), value: z.string() })).optional().default([]),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const withdrawApplicationSchema = z.object({
  status: z.literal("WITHDRAWN"),
});
export type WithdrawApplicationInput = z.infer<typeof withdrawApplicationSchema>;
