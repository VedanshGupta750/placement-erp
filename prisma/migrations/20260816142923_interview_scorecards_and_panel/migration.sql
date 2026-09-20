-- AlterTable
ALTER TABLE "round_candidates" ADD COLUMN     "criteriaScores" JSONB;

-- CreateTable
CREATE TABLE "scorecard_templates" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_panel_members" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "roundCandidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Panel Member',
    "score" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_panel_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_templates_collegeId_roundType_key" ON "scorecard_templates"("collegeId", "roundType");

-- CreateIndex
CREATE INDEX "interview_panel_members_roundCandidateId_idx" ON "interview_panel_members"("roundCandidateId");

-- AddForeignKey
ALTER TABLE "scorecard_templates" ADD CONSTRAINT "scorecard_templates_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panel_members" ADD CONSTRAINT "interview_panel_members_roundCandidateId_fkey" FOREIGN KEY ("roundCandidateId") REFERENCES "round_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
