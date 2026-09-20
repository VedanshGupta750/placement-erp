import { z } from "zod";

export const setDefaultResumeSchema = z.object({
  isDefault: z.literal(true),
});
export type SetDefaultResumeInput = z.infer<typeof setDefaultResumeSchema>;
