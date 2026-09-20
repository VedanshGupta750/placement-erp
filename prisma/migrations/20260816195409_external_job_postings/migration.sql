-- CreateEnum
CREATE TYPE "ExternalJobReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "external_job_postings" (
    "id" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "link" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "matchedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_job_reviews" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "status" "ExternalJobReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_job_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_job_postings_firstSeenAt_idx" ON "external_job_postings"("firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_job_postings_company_sourceJobId_key" ON "external_job_postings"("company", "sourceJobId");

-- CreateIndex
CREATE INDEX "external_job_reviews_collegeId_status_idx" ON "external_job_reviews"("collegeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "external_job_reviews_collegeId_postingId_key" ON "external_job_reviews"("collegeId", "postingId");

-- AddForeignKey
ALTER TABLE "external_job_reviews" ADD CONSTRAINT "external_job_reviews_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_job_reviews" ADD CONSTRAINT "external_job_reviews_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "external_job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_job_reviews" ADD CONSTRAINT "external_job_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
