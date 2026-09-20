// Real, assessment-backed talent-pool stats for a recruiting company — the
// one place in this app where placement CRM data (who's eligible for a
// given company) and assessment-engine data (StudentSkillProfile, synced
// from the fully separate ~/placement-erp-assessments app — see
// scripts/sync-student-skill-profiles.ts) come together. No competitor
// combines both halves, so this view is a genuine differentiator — but
// only worth showing when there's real signal behind it: honesty about
// sample size matters more here than anywhere else in this app, since
// this number may get shown directly to a recruiting company.
import type { TenantDb } from "@/lib/tenant/scoped-db";

// Below this many eligible students with real assessment data, an
// aggregate percentage is more noise than signal — same philosophy as
// lib/forecasts/pipeline-forecast.ts's MIN_SAMPLE.
const MIN_SAMPLE_FOR_SIGNAL = 5;
const STRONG_SCORE_THRESHOLD_PERCENT = 70;

export async function getCompanyTalentSkillInsights(
  db: TenantDb,
  company: { preferredCourseIds: string[]; minCgpaPreference: unknown; backlogPolicy: string | null }
) {
  const where: Record<string, unknown> = { hasPlacementAccess: true };
  if (company.preferredCourseIds.length > 0) where.courseId = { in: company.preferredCourseIds };
  if (company.minCgpaPreference != null) where.aggregate = { gte: Number(company.minCgpaPreference) };
  if (company.backlogPolicy === "NO_ACTIVE_BACKLOGS") where.liveBacklogs = 0;

  const [eligibleCount, profiles] = await Promise.all([
    db.student.count({ where }),
    db.studentSkillProfile.findMany({
      where: { student: where, finalizedAttemptCount: { gt: 0 } },
      select: { avgScorePercent: true, avgCodingPassPercent: true, finalizedAttemptCount: true },
    }),
  ]);

  const withScores = profiles.filter((p: { avgScorePercent: number | null }) => p.avgScorePercent != null);
  const confident = withScores.length >= MIN_SAMPLE_FOR_SIGNAL;

  const avgScorePercent = confident
    ? Math.round(
        (withScores.reduce((sum: number, p: { avgScorePercent: number | null }) => sum + (p.avgScorePercent ?? 0), 0) / withScores.length) * 10
      ) / 10
    : null;
  const strongPercent = confident
    ? Math.round(
        (withScores.filter((p: { avgScorePercent: number | null }) => (p.avgScorePercent ?? 0) >= STRONG_SCORE_THRESHOLD_PERCENT).length /
          withScores.length) *
          1000
      ) / 10
    : null;

  const codingProfiles = profiles.filter((p: { avgCodingPassPercent: number | null }) => p.avgCodingPassPercent != null);
  const confidentCoding = codingProfiles.length >= MIN_SAMPLE_FOR_SIGNAL;
  const avgCodingPassPercent = confidentCoding
    ? Math.round(
        (codingProfiles.reduce((sum: number, p: { avgCodingPassPercent: number | null }) => sum + (p.avgCodingPassPercent ?? 0), 0) /
          codingProfiles.length) *
          10
      ) / 10
    : null;

  return {
    eligibleCount,
    assessedCount: withScores.length,
    confident,
    avgScorePercent,
    strongPercent,
    strongThresholdPercent: STRONG_SCORE_THRESHOLD_PERCENT,
    confidentCoding,
    codingAssessedCount: codingProfiles.length,
    avgCodingPassPercent,
  };
}
