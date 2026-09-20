import { z } from "zod";

export const createApplicationSchema = z.object({
  driveId: z.string().min(1, "Drive is required."),
  positionId: z.string().min(1, "Position is required."),
  resumeId: z.string().optional(),
  fieldValues: z.array(z.object({ fieldId: z.string(), value: z.string() })).optional().default([]),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const withdrawApplicationSchema = z.object({
  status: z.literal("WITHDRAWN"),
});
export type WithdrawApplicationInput = z.infer<typeof withdrawApplicationSchema>;
