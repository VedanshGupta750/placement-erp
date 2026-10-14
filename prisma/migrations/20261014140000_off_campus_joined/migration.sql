-- Off-campus placements get a "joined" milestone, mirroring the campus
-- offer's JOINED state, so the Job Offers and Internship Offers pages can
-- show one lifecycle across both routes.
ALTER TABLE "off_campus_placements" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3);
