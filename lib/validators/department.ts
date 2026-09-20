import { z } from "zod";

export const addDepartmentMemberSchema = z.object({
  userId: z.string().trim().min(1),
  designation: z.string().trim().min(1, "Designation is required."),
  title: z.string().trim().min(1, "Title is required."),
  isAdmin: z.boolean().default(false),
});
export type AddDepartmentMemberInput = z.infer<typeof addDepartmentMemberSchema>;

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  code: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
