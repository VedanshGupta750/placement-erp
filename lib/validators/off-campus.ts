import { z } from "zod";

// An off-campus placement is usually recorded from a forwarded email or a
// screenshot of an offer letter, so almost everything beyond the company
// name is optional — a TPO often learns the fact well before the figures.
// Blank strings are normalised to undefined rather than being coerced, so an
// empty box never writes 0 or "" over a real value.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalMoney = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" && v.trim() === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "Must be a positive amount.")
  .optional();

const optionalInt = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" && v.trim() === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isInteger(v) && v > 0 && v <= 60), "Must be between 1 and 60 months.")
  .optional();

export const offCampusPlacementSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required."),
  role: optionalText,
  placementType: z.enum(["JOB", "INTERNSHIP"]),
  totalCompensation: optionalMoney,
  stipend: optionalMoney,
  durationMonths: optionalInt,
  location: optionalText,
  offerDate: optionalText,
  joiningDate: optionalText,
  source: optionalText,
  notes: optionalText,
});
export type OffCampusPlacementInput = z.infer<typeof offCampusPlacementSchema>;

// Verification is a separate action from editing the figures: "I have seen
// the offer letter" is a different decision from "the stipend was wrong".
export const offCampusStatusSchema = z.object({
  status: z.enum(["REPORTED", "VERIFIED", "REJECTED"]),
});
export type OffCampusStatusInput = z.infer<typeof offCampusStatusSchema>;
