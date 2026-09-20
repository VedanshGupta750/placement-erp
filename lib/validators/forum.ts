import { z } from "zod";

export const createForumSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
});

export const createForumPostSchema = z.object({
  title: z.string().trim().min(3),
  body: z.string().trim().min(1),
});

export const createReplySchema = z.object({
  body: z.string().trim().min(1),
});
