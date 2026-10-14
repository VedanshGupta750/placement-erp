-- College-wide placement eligibility policy (TPO-settable under Settings).
-- Hand-written rather than generated: `prisma migrate dev` refuses to run on
-- this database because of pre-existing drift (the applied
-- 20260917190500_add_college_branding migration has no folder in the repo),
-- and it offers to reset the database instead. Applied with `migrate deploy`.
--
-- All thresholds are nullable on purpose: NULL means "this check is off",
-- which is a different thing from a threshold of 0.
ALTER TABLE "colleges"
  ADD COLUMN IF NOT EXISTS "eligibilityPolicyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "eligibilityMinCgpa" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "eligibilityMaxLiveBacklogs" INTEGER,
  ADD COLUMN IF NOT EXISTS "eligibilityMinTenthScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "eligibilityMinTwelfthScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "eligibilityRequireAcademics" BOOLEAN NOT NULL DEFAULT false;
