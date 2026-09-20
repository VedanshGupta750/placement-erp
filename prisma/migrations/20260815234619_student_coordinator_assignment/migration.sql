-- AlterTable
ALTER TABLE "students" ADD COLUMN     "assignedCoordinatorId" TEXT;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_assignedCoordinatorId_fkey" FOREIGN KEY ("assignedCoordinatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
