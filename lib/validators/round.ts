import { z } from "zod";

export const createRoundSchema = z.object({
  name: z.string().trim().min(2),
  roundType: z.string().trim().min(2),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
});

export const scheduleCandidateSchema = z.object({
  mode: z.enum(["ONLINE", "OFFLINE"]).optional(),
  scheduledAt: z.string().optional(),
  venue: z.string().optional(),
  meetingUrl: z.string().optional(),
  interviewerName: z.string().optional(),
  interviewerId: z.string().optional(),
});

export const RECOMMENDATIONS = ["STRONG_HIRE", "HIRE", "HOLD", "REJECT"] as const;

export const scoreCandidateSchema = z.object({
  score: z.coerce.number().min(0).max(100).optional(),
  feedback: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  recommendation: z.enum(RECOMMENDATIONS).optional(),
  result: z.enum(["PASSED", "FAILED"]),
  // { [criterionKey]: 0-10 } — when present, `score` above is ignored and
  // recomputed server-side as the average, scaled to /100, so a client
  // can't submit a mismatched overall score.
  criteriaScores: z.record(z.string(), z.coerce.number().min(0).max(10)).optional(),
});

export const scorecardTemplateSchema = z.object({
  roundType: z.string().trim().min(2),
  criteria: z.array(z.object({ key: z.string().trim().min(1), label: z.string().trim().min(1) })).min(1).max(10),
});

export const panelMemberSchema = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
});

export const panelMemberScoreSchema = z.object({
  score: z.coerce.number().min(0).max(100).optional(),
  feedback: z.string().optional(),
  role: z.string().trim().min(1).optional(),
});

export const cancelCandidateSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export const noShowCandidateSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});
