-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "driveId" TEXT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "drives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
