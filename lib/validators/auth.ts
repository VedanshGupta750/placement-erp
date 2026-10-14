import { z } from "zod";

// Surrounding whitespace is stripped from every password, on the way in
// AND on the way out.
//
// Students receive a starter password that is their enrollment number, and
// they paste it out of a spreadsheet or a message — which routinely carries
// a trailing space or newline. bcrypt compares bytes, so " 2026100007"
// never matches "2026100007", and the only feedback is "Invalid email or
// password". That is indistinguishable from a broken import, and it cost
// real time here: a correct account, correct credentials, and six failed
// attempts across three students.
//
// Trimming on BOTH sides is what makes it safe. Trimming only at sign-in
// would lock out anyone who had set a password with a trailing space; doing
// both means the stored hash and the attempt are always normalised the same
// way. The cost is that a password cannot begin or end with a space, which
// no password policy here asks for.
export const passwordStrengthSchema = z
  .string()
  .trim()
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
  // See passwordStrengthSchema above for why this is trimmed.
  password: z.string().trim().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const companyLoginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().trim().min(1, "Password is required."),
});
export type CompanyLoginInput = z.infer<typeof companyLoginSchema>;

export const inviteRecruiterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.email("Enter a valid email address.").trim(),
});
export type InviteRecruiterInput = z.infer<typeof inviteRecruiterSchema>;
