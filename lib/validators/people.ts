import { z } from "zod";

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.email("Enter a valid email address."),
  userType: z.enum(["STUDENT", "FACULTY", "MANAGEMENT", "PLACEMENT_TEAM"]),
  roleId: z.string().optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const createCourseSchema = z.object({
  name: z.string().trim().min(2),
  degree: z.string().trim().min(1),
  specialization: z.string().trim().optional(),
  years: z.coerce.number().int().min(1).max(6).default(4),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const createPlacementCategorySchema = z.object({
  name: z.string().trim().min(2),
  minPackage: z.coerce.number().nonnegative().optional(),
  maxPackage: z.coerce.number().nonnegative().optional(),
  maxOffersPerStudent: z.coerce.number().int().positive().optional(),
});
export type CreatePlacementCategoryInput = z.infer<typeof createPlacementCategorySchema>;
