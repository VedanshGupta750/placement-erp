import { z } from "zod";

// A simplified authoring surface over the general AND/OR/NOT tree in
// lib/eligibility.ts — covers the common case (minimum CGPA + maximum
// backlogs + optional specific-course narrowing beyond the drive's base
// eligible-courses list) as a flat AND. The evaluator itself supports the
// full nested tree; a richer visual rule builder can compose that same
// `EligibilityLogic` shape later without changing the API contract.
export const createEligibilityRuleSchema = z.object({
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  maxActiveBacklogs: z.coerce.number().int().min(0).optional(),
  minTenth: z.coerce.number().min(0).max(100).optional(),
  minTwelfth: z.coerce.number().min(0).max(100).optional(),
  minDiploma: z.coerce.number().min(0).max(100).optional(),
  maxClosedBacklogs: z.coerce.number().int().min(0).optional(),
  requiredSkillIds: z.array(z.string()).optional(),
  requireExperience: z.boolean().optional(),
  requireCertification: z.boolean().optional(),
});
export type CreateEligibilityRuleInput = z.infer<typeof createEligibilityRuleSchema>;

export const overrideSchema = z.object({
  studentId: z.string(),
  decision: z.enum(["ELIGIBLE", "NOT_ELIGIBLE"]),
  reason: z.string().min(3, "A reason is required."),
});
export type OverrideInput = z.infer<typeof overrideSchema>;
