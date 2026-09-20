import { z } from "zod";

export const collegeDetailsSchema = z.object({
  name: z.string().trim().min(2).optional(),
  logoUrl: z.string().trim().optional(),
  university: z.string().trim().optional(),
  website: z.string().trim().optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
});
export type CollegeDetailsInput = z.infer<typeof collegeDetailsSchema>;

export const createBatchSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const batchSettingsSchema = z.object({
  registrationEnabled: z.boolean().optional(),
  loginAllowed: z.boolean().optional(),
  allowDiploma: z.boolean().optional(),
  requireApprovalForAcademicsUpdate: z.boolean().optional(),
  autoApprovalOnRegistration: z.boolean().optional(),
});
export type BatchSettingsInput = z.infer<typeof batchSettingsSchema>;
