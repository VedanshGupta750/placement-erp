import { z } from "zod";

export const createOfferSchema = z.object({
  applicationId: z.string(),
  offerType: z.enum(["JOB", "INTERNSHIP", "PPO"]),
  totalCompensation: z.coerce.number().positive(),
  fixedCompensation: z.coerce.number().nonnegative().optional(),
  variableCompensation: z.coerce.number().nonnegative().optional(),
  stipend: z.coerce.number().nonnegative().optional(),
  joiningBonus: z.coerce.number().nonnegative().optional(),
  joiningDate: z.string().optional(),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const respondToOfferSchema = z.object({
  action: z.enum(["accept", "decline"]),
});
export type RespondToOfferInput = z.infer<typeof respondToOfferSchema>;

export const editOfferSchema = z.object({
  offerType: z.enum(["JOB", "INTERNSHIP", "PPO"]).optional(),
  totalCompensation: z.coerce.number().positive().optional(),
  fixedCompensation: z.coerce.number().nonnegative().optional(),
  variableCompensation: z.coerce.number().nonnegative().optional(),
  stipend: z.coerce.number().nonnegative().optional(),
  joiningBonus: z.coerce.number().nonnegative().optional(),
  joiningDate: z.string().optional(),
});
export type EditOfferInput = z.infer<typeof editOfferSchema>;
