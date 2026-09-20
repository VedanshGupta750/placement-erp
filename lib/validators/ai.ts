import { z } from "zod";

export const copilotQuestionSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export const parseResumeSchema = z.object({
  text: z.string().trim().min(20).max(20000),
});

export const parseJdSchema = z.object({
  text: z.string().trim().min(20).max(20000),
});
