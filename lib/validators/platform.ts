import { z } from "zod";
import { passwordStrengthSchema } from "@/lib/validators/auth";

// Platform (Super Admin) tier — the operator's own console, outside every
// tenant college. See app/platform and lib/auth/platform-session.ts.

export const platformLoginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  // Same normalisation as lib/validators/auth.ts — see the note there.
  password: z.string().trim().min(1, "Password is required."),
});
export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;

// Onboarding a college is now an operator action, not public self-service —
// the old open /api/auth/signup route is gone. Shape matches
// ProvisionCollegeInput exactly so it can be passed straight through.
export const createCollegeSchema = z.object({
  collegeName: z.string().trim().min(2, "College name must be at least 2 characters."),
  tpoName: z.string().trim().min(2, "The TPO's name must be at least 2 characters."),
  tpoEmail: z.email("Enter a valid email address.").trim(),
  tpoPassword: passwordStrengthSchema,
});
export type CreateCollegeInput = z.infer<typeof createCollegeSchema>;
