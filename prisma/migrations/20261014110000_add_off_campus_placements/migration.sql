-- Placements a student secured on their own, outside the college's drives.
-- Kept separate from Offer because Offer.driveId is required and the whole
-- offer lifecycle, drive funnel counters and company-scoped reporting hang
-- off that drive. See the model comment in schema.prisma.
--
-- Hand-written: `prisma migrate dev` refuses on this database because of
-- pre-existing drift (20260917190500_add_college_branding is applied but has
-- no folder here) and offers to reset instead. Applied with `migrate deploy`.

CREATE TYPE "OffCampusPlacementType" AS ENUM ('JOB', 'INTERNSHIP');
CREATE TYPE "OffCampusPlacementStatus" AS ENUM ('REPORTED', 'VERIFIED', 'REJECTED');

CREATE TABLE "off_campus_placements" (
  "id"                TEXT NOT NULL,
  "collegeId"         TEXT NOT NULL,
  "studentId"         TEXT NOT NULL,
  "companyName"       TEXT NOT NULL,
  "role"              TEXT,
  "placementType"     "OffCampusPlacementType" NOT NULL DEFAULT 'JOB',
  "status"            "OffCampusPlacementStatus" NOT NULL DEFAULT 'REPORTED',
  "totalCompensation" DECIMAL(12,2),
  "stipend"           DECIMAL(10,2),
  "durationMonths"    INTEGER,
  "location"          TEXT,
  "offerDate"         TIMESTAMP(3),
  "joiningDate"       TIMESTAMP(3),
  "source"            TEXT,
  "notes"             TEXT,
  "proofFileId"       TEXT,
  "recordedById"      TEXT,
  "verifiedById"      TEXT,
  "verifiedAt"        TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "off_campus_placements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "off_campus_placements_collegeId_status_idx" ON "off_campus_placements" ("collegeId", "status");
CREATE INDEX "off_campus_placements_studentId_idx" ON "off_campus_placements" ("studentId");

ALTER TABLE "off_campus_placements"
  ADD CONSTRAINT "off_campus_placements_collegeId_fkey"
  FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cascade: a deleted student takes their off-campus record with them, the
-- same as every other Student relation (see lib/students/delete.ts).
ALTER TABLE "off_campus_placements"
  ADD CONSTRAINT "off_campus_placements_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "off_campus_placements"
  ADD CONSTRAINT "off_campus_placements_proofFileId_fkey"
  FOREIGN KEY ("proofFileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SetNull on the staff links: removing a staff account must not delete the
-- placement record they happened to enter.
ALTER TABLE "off_campus_placements"
  ADD CONSTRAINT "off_campus_placements_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "off_campus_placements"
  ADD CONSTRAINT "off_campus_placements_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
