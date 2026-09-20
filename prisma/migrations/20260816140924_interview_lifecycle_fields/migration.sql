-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoundCandidateStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "RoundCandidateStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "RoundCandidateStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "round_candidates" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "noShowReason" TEXT,
ADD COLUMN     "recommendation" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "strengths" TEXT,
ADD COLUMN     "weaknesses" TEXT;
