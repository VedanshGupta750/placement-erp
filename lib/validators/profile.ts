import { z } from "zod";

export const updateUserProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").optional(),
  phone: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
});
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const changePasswordSchema = z.object({
  // Trimmed to match how it was stored — see lib/validators/auth.ts.
  currentPassword: z.string().trim().min(1, "Current password is required."),
  newPassword: z.string().trim().min(8, "New password must be at least 8 characters."),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  summary: z.string().trim().optional(),
  expertise: z.array(z.string().trim().min(1)).optional(),
  areasOfInterest: z.array(z.string().trim().min(1)).optional(),
  values: z.array(z.string().trim().min(1)).optional(),
  languagesSpeaking: z.array(z.string().trim().min(1)).optional(),
  languagesProgramming: z.array(z.string().trim().min(1)).optional(),
  awardsJson: z.array(z.string().trim().min(1)).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const createExperienceSchema = z.object({
  organisation: z.string().trim().min(1, "Organisation is required."),
  role: z.string().trim().min(1, "Role is required."),
  experienceType: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().trim().optional(),
});
export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().optional(),
  techStack: z.array(z.string().trim().min(1)).optional(),
  url: z.string().trim().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const addSkillsSchema = z.object({
  skillNames: z.array(z.string().trim().min(1)).min(1).max(50),
});
export type AddSkillsInput = z.infer<typeof addSkillsSchema>;

export const createCertificationSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  issuer: z.string().trim().optional(),
  issueDate: z.string().optional(),
  credentialUrl: z.string().trim().optional(),
});
export type CreateCertificationInput = z.infer<typeof createCertificationSchema>;
