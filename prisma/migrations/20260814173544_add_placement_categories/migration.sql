-- AlterTable
ALTER TABLE "drives" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "placement_categories" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPackage" DECIMAL(12,2),
    "maxPackage" DECIMAL(12,2),
    "maxOffersPerStudent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_categories_collegeId_idx" ON "placement_categories"("collegeId");

-- AddForeignKey
ALTER TABLE "placement_categories" ADD CONSTRAINT "placement_categories_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drives" ADD CONSTRAINT "drives_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "placement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
