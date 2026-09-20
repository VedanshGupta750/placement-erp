-- CreateEnum
CREATE TYPE "CompanyDocumentCategory" AS ENUM ('MOU', 'NDA', 'JOB_DESCRIPTION', 'OFFER_TEMPLATE', 'BROCHURE', 'HIRING_POLICY', 'SALARY_STRUCTURE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartnershipStatus" ADD VALUE 'PARTNER';
ALTER TYPE "PartnershipStatus" ADD VALUE 'DORMANT';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "backlogPolicy" TEXT,
ADD COLUMN     "foundedYear" INTEGER,
ADD COLUMN     "headquarters" TEXT,
ADD COLUMN     "hiringType" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "minCgpaPreference" DECIMAL(4,2),
ADD COLUMN     "preferredCourseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferredSkillIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "size" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "CompanyDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_documents_collegeId_idx" ON "company_documents"("collegeId");

-- CreateIndex
CREATE INDEX "company_documents_companyId_idx" ON "company_documents"("companyId");

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
