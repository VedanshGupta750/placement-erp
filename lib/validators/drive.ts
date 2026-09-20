import { z } from "zod";

export const createDriveSchema = z.object({
  title: z.string().trim().min(3, "Title is required."),
  companyName: z.string().trim().min(2, "Company name is required."),
  positionType: z.enum(["JOB", "INTERNSHIP", "JOB_AND_INTERNSHIP"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "INTERNSHIP_PLUS_PPO"]),
  locationCategory: z.enum(["ON_CAMPUS", "OFF_CAMPUS", "POOL_CAMPUS", "VIRTUAL"]),
  minCtc: z.coerce.number().nonnegative().optional(),
  maxCtc: z.coerce.number().nonnegative().optional(),
  maxStipend: z.coerce.number().nonnegative().optional(),
  expectedOpenings: z.coerce.number().int().nonnegative().optional(),
  eligibilityCriteria: z.string().optional(),
  selectionProcessDetails: z.string().optional(),
  otherDetails: z.string().optional(),
  contactPersons: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  courseIds: z.array(z.string()).min(1, "Select at least one eligible course."),
  skillIds: z.array(z.string()).optional(),
});
export type CreateDriveInput = z.infer<typeof createDriveSchema>;

export const createDriveApplicationFieldSchema = z.object({
  label: z.string().trim().min(2),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE", "SELECT"]).default("TEXT"),
  options: z.array(z.string()).optional().default([]),
  required: z.coerce.boolean().optional().default(false),
});
export type CreateDriveApplicationFieldInput = z.infer<typeof createDriveApplicationFieldSchema>;
