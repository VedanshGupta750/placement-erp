import { z } from "zod";

// Fixed option lists — single source of truth for both the Zod validators
// below and the <Select> built against them, so the UI and the API can
// never drift apart on what's a valid value. Plain strings (not enums,
// same convention as Contact.relationshipStage/Company.industryType) so
// the list can grow without a migration.
export const EXPENSE_CATEGORIES = [
  "Venue",
  "Catering",
  "Travel & Logistics",
  "Marketing & Branding",
  "Guest Honorarium",
  "Software & Tools",
  "Printing & Stationery",
  "Other",
] as const;

export const REVENUE_SOURCES = ["Company Recruitment Fee", "Sponsorship", "Government Grant", "Alumni Contribution", "Other"] as const;

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(2, "Description is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  expenseDate: z.string().min(1, "Date is required."),
  driveId: z.string().trim().optional(),
  eventId: z.string().trim().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const createRevenueSchema = z.object({
  source: z.enum(REVENUE_SOURCES),
  description: z.string().trim().min(2, "Description is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  receivedDate: z.string().min(1, "Date is required."),
  companyId: z.string().trim().optional(),
  driveId: z.string().trim().optional(),
  eventId: z.string().trim().optional(),
});
export type CreateRevenueInput = z.infer<typeof createRevenueSchema>;
