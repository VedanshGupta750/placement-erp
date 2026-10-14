-- ResumeUsage was unique on (resumeId, driveId), asserting that a resume
-- could only ever be used once per drive. A drive can have several
-- positions, so that is not true: applying to a second position with the
-- same resume raised a unique violation, which the apply route reported to
-- the student as "You've already applied to this position".
--
-- The real grain is the application. Also switches the application link to
-- ON DELETE CASCADE so a deleted application takes its usage rows with it,
-- instead of leaving an orphan behind that blocked re-applying.
--
-- Hand-written: `prisma migrate dev` refuses on this database because of
-- pre-existing drift (20260917190500_add_college_branding is applied but has
-- no folder here) and offers to reset instead. Applied with `migrate deploy`.

-- Safety net: collapse any rows that would violate the new key. None exist
-- in this database, but a college that ran the old seed might have some.
DELETE FROM "resume_usages" a
  USING "resume_usages" b
  WHERE a."applicationId" IS NOT NULL
    AND a."resumeId" = b."resumeId"
    AND a."applicationId" = b."applicationId"
    AND a.ctid > b.ctid;

DROP INDEX IF EXISTS "resume_usages_resumeId_driveId_key";

CREATE UNIQUE INDEX "resume_usages_resumeId_applicationId_key"
  ON "resume_usages" ("resumeId", "applicationId");

ALTER TABLE "resume_usages" DROP CONSTRAINT IF EXISTS "resume_usages_applicationId_fkey";
ALTER TABLE "resume_usages"
  ADD CONSTRAINT "resume_usages_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
