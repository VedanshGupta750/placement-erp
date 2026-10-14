-- Three related changes.
--
-- 1. "Placed" becomes a confirmed decision rather than something inferred
--    from an offer. An accepted offer or an off-campus internship is
--    evidence; a staff member confirms it. Backfilled below so no existing
--    figure moves on deploy.
-- 2. A TPO-settable placement cap policy. The MODE is configurable, not
--    just the numbers, because colleges differ on whether the bar is a
--    college-wide floor or a multiple of the student's current offer.
-- 3. Technical / non-technical flags on courses and drives, for the
--    cross-category half of that policy.
--
-- Hand-written: `prisma migrate dev` refuses on this database because of
-- pre-existing drift (20260917190500_add_college_branding is applied but
-- has no folder here). Applied with `migrate deploy`.

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "placementConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "placementConfirmedById" TEXT,
  ADD COLUMN IF NOT EXISTS "placementConfirmedNote" TEXT;

ALTER TABLE "students"
  DROP CONSTRAINT IF EXISTS "students_placementConfirmedById_fkey";
ALTER TABLE "students"
  ADD CONSTRAINT "students_placementConfirmedById_fkey"
  FOREIGN KEY ("placementConfirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "colleges"
  ADD COLUMN IF NOT EXISTS "placementCapEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "placementCapMode" TEXT NOT NULL DEFAULT 'FIXED_FLOOR',
  ADD COLUMN IF NOT EXISTS "placementCapFloor" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "placementCapMultiplier" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "placementCapCrossEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "placementCapCrossFloor" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "placementCapCrossMultiplier" DOUBLE PRECISION;

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "isTechnical" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "drives"  ADD COLUMN IF NOT EXISTS "isTechnical" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: anyone already holding a placing campus offer is confirmed
-- placed, dated from that offer. Without this every existing placement
-- would read as unplaced the moment this ships, and a college's reported
-- rate would drop to zero overnight.
UPDATE "students" s
SET "placementConfirmedAt" = o."acceptedAt",
    "placementConfirmedNote" = 'Backfilled from an accepted campus offer'
FROM (
  SELECT DISTINCT ON ("studentId") "studentId", COALESCE("acceptedAt", "updatedAt") AS "acceptedAt"
  FROM "offers"
  WHERE "status" IN ('ACCEPTED', 'JOINING_PENDING', 'JOINED')
  ORDER BY "studentId", "acceptedAt" DESC NULLS LAST
) o
WHERE o."studentId" = s."id" AND s."placementConfirmedAt" IS NULL;
