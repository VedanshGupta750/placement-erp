import { z } from "zod";

// Budget categories are free text (not a fixed enum like
// EXPENSE_CATEGORIES) — a college's own budget-note structure varies year
// to year and department to department, unlike expense categories which
// benefit from staying consistent for reporting.
export const createBudgetItemSchema = z.object({
  fiscalYear: z.string().trim().min(4, "Fiscal year is required (e.g. 2026-2027)."),
  category: z.string().trim().min(2, "Category is required."),
  item: z.string().trim().min(2, "Item is required."),
  allottedAmount: z.coerce.number().nonnegative().optional().nullable(),
  utilizedAmount: z.coerce.number().nonnegative().optional().nullable(),
  requestedAmount: z.coerce.number().nonnegative().optional().nullable(),
});
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;

export const updateBudgetItemSchema = z.object({
  allottedAmount: z.coerce.number().nonnegative().optional().nullable(),
  utilizedAmount: z.coerce.number().nonnegative().optional().nullable(),
  requestedAmount: z.coerce.number().nonnegative().optional().nullable(),
});
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
