-- AlterTable
ALTER TABLE "round_candidates" ADD COLUMN     "interviewerId" TEXT;

-- AddForeignKey
ALTER TABLE "round_candidates" ADD CONSTRAINT "round_candidates_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
