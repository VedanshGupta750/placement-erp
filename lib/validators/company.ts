import { z } from "zod";

export const COMPANY_SIZES = ["1-50", "51-200", "201-1000", "1001-5000", "5001-10000", "10001+"] as const;
export const HIRING_TYPES = ["Full-time", "Internship", "Both"] as const;
export const BACKLOG_POLICIES = ["NO_ACTIVE_BACKLOGS", "UP_TO_1", "UP_TO_2", "NO_RESTRICTION"] as const;

export const PARTNERSHIP_STATUS_LABELS: Record<string, string> = {
  PENDING: "Prospect",
  ACTIVE: "Active",
  PARTNER: "Partner",
  DORMANT: "Dormant",
  BLOCKED: "Blacklisted",
};

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required."),
  legalName: z.string().trim().optional(),
  website: z.string().trim().optional(),
  industryType: z.string().trim().optional(),
  companyType: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  about: z.string().trim().optional(),
  size: z.enum(COMPANY_SIZES).optional(),
  headquarters: z.string().trim().optional(),
  foundedYear: z.number().int().optional(),
  linkedinUrl: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  hiringType: z.enum(HIRING_TYPES).optional(),
  preferredCourseIds: z.array(z.string()).optional(),
  minCgpaPreference: z.number().min(0).max(10).optional(),
  backlogPolicy: z.enum(BACKLOG_POLICIES).optional(),
  preferredSkillIds: z.array(z.string()).optional(),
  recruiter: z
    .object({
      name: z.string().trim().min(1),
      email: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      designation: z.string().trim().optional(),
    })
    .optional(),
  force: z.boolean().optional(),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema
  .omit({ name: true, recruiter: true, force: true })
  .partial()
  .extend({ name: z.string().trim().min(1).optional() });
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
