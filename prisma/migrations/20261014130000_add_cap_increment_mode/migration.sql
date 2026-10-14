-- INCREMENT cap mode: the next drive must beat the student's current
-- package by a fixed step the TPO sets. A student on 6 LPA with a 4 LPA
-- step can only apply at 10 LPA and above.
--
-- This is the rule most Indian campuses actually use, and it is now the
-- default mode for new colleges. The absolute-floor and multiplier modes
-- stay available — the TPO picks under Settings, nothing is hardcoded.
ALTER TABLE "colleges"
  ADD COLUMN IF NOT EXISTS "placementCapIncrement" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "placementCapCrossIncrement" DECIMAL(12,2);

ALTER TABLE "colleges" ALTER COLUMN "placementCapMode" SET DEFAULT 'INCREMENT';
