import { z } from "zod";

export const passwordStrengthSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[a-zA-Z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const signupSchema = z.object({
  collegeName: z.string().trim().min(2, "College name must be at least 2 characters."),
  tpoName: z.string().trim().min(2, "Your name must be at least 2 characters."),
  tpoEmail: z.email("Enter a valid email address.").trim(),
  tpoPassword: passwordStrengthSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const companyLoginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().min(1, "Password is required."),
});
export type CompanyLoginInput = z.infer<typeof companyLoginSchema>;

export const inviteRecruiterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.email("Enter a valid email address.").trim(),
});
export type InviteRecruiterInput = z.infer<typeof inviteRecruiterSchema>;
