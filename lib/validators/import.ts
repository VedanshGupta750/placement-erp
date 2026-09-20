import { z } from "zod";

export const importStudentRowSchema = z.object({
  enrollmentNumber: z.string().trim().min(1, "Enrollment number is required"),
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email"),
  courseName: z.string().trim().min(1, "Course is required"),
  batchYear: z.coerce.number().int().min(2000).max(2100),
  aggregate: z.coerce.number().min(0).max(10).optional(),
  liveBacklogs: z.coerce.number().int().min(0).optional(),
});
export type ImportStudentRow = z.infer<typeof importStudentRowSchema>;

export const IMPORT_TEMPLATE_HEADERS = ["enrollmentNumber", "name", "email", "courseName", "batchYear", "aggregate", "liveBacklogs"];

export const importContactRowSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  contactType: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  relationshipStage: z.string().trim().optional(),
});
export type ImportContactRow = z.infer<typeof importContactRowSchema>;

export const CONTACT_IMPORT_TEMPLATE_HEADERS = ["name", "email", "phone", "companyName", "contactType", "designation", "relationshipStage"];

export const importCompanyRowSchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  industryType: z.string().trim().optional(),
  website: z.string().trim().optional(),
  headquarters: z.string().trim().optional(),
  size: z.string().trim().optional(),
  hiringType: z.string().trim().optional(),
});
export type ImportCompanyRow = z.infer<typeof importCompanyRowSchema>;

export const COMPANY_IMPORT_TEMPLATE_HEADERS = ["name", "industryType", "website", "headquarters", "size", "hiringType"];

export const importDriveRowSchema = z.object({
  title: z.string().trim().min(1, "Drive title is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  courseNames: z.string().trim().min(1, "At least one course name is required"),
  positionType: z.enum(["JOB", "INTERNSHIP", "JOB_AND_INTERNSHIP"]).default("JOB"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "INTERNSHIP_PLUS_PPO"]).default("FULL_TIME"),
  minCtc: z.coerce.number().nonnegative().optional(),
  maxCtc: z.coerce.number().nonnegative().optional(),
  openings: z.coerce.number().int().nonnegative().optional(),
  registrationClosesAt: z.string().trim().optional(),
});
export type ImportDriveRow = z.infer<typeof importDriveRowSchema>;

export const DRIVE_IMPORT_TEMPLATE_HEADERS = ["title", "companyName", "courseNames", "positionType", "employmentType", "minCtc", "maxCtc", "openings", "registrationClosesAt"];

export const importApplicationRowSchema = z.object({
  enrollmentNumber: z.string().trim().min(1, "Enrollment number is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  driveTitle: z.string().trim().min(1, "Drive title is required"),
});
export type ImportApplicationRow = z.infer<typeof importApplicationRowSchema>;

export const APPLICATION_IMPORT_TEMPLATE_HEADERS = ["enrollmentNumber", "companyName", "driveTitle"];
