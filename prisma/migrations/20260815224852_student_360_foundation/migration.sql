-- CreateEnum
CREATE TYPE "StudentDocumentCategory" AS ENUM ('RESUME', 'TENTH_MARKSHEET', 'TWELFTH_MARKSHEET', 'DIPLOMA_MARKSHEET', 'SEMESTER_MARKSHEET', 'ID_PROOF', 'CERTIFICATE', 'OFFER_LETTER', 'JOINING_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentBacklogStatus" AS ENUM ('ACTIVE', 'CLEARED');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "student_documents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "category" "StudentDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "uploadedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_notes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_backlogs" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT,
    "semester" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "StudentBacklogStatus" NOT NULL DEFAULT 'ACTIVE',
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_backlogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_semester_results" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "sgpa" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_semester_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_saved_views" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_documents_studentId_idx" ON "student_documents"("studentId");

-- CreateIndex
CREATE INDEX "student_notes_studentId_idx" ON "student_notes"("studentId");

-- CreateIndex
CREATE INDEX "student_backlogs_studentId_idx" ON "student_backlogs"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_semester_results_studentId_semester_key" ON "student_semester_results"("studentId", "semester");

-- CreateIndex
CREATE INDEX "student_saved_views_collegeId_userId_idx" ON "student_saved_views"("collegeId", "userId");

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_backlogs" ADD CONSTRAINT "student_backlogs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_semester_results" ADD CONSTRAINT "student_semester_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_saved_views" ADD CONSTRAINT "student_saved_views_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_saved_views" ADD CONSTRAINT "student_saved_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
