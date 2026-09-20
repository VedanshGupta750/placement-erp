-- AlterTable
ALTER TABLE "drives" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "drives" ADD CONSTRAINT "drives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
