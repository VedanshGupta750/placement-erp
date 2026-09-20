-- CreateTable
CREATE TABLE "student_skill_profiles" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "finalizedAttemptCount" INTEGER NOT NULL,
    "avgScorePercent" DOUBLE PRECISION,
    "codingSubmissionCount" INTEGER NOT NULL DEFAULT 0,
    "avgCodingPassPercent" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_skill_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_skill_profiles_studentId_key" ON "student_skill_profiles"("studentId");

-- CreateIndex
CREATE INDEX "student_skill_profiles_collegeId_idx" ON "student_skill_profiles"("collegeId");

-- AddForeignKey
ALTER TABLE "student_skill_profiles" ADD CONSTRAINT "student_skill_profiles_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skill_profiles" ADD CONSTRAINT "student_skill_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
