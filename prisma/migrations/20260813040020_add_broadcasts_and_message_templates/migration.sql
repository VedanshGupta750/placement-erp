-- CreateEnum
CREATE TYPE "BroadcastAudienceType" AS ENUM ('ALL_STUDENTS', 'ALL_STAFF', 'BATCH', 'DEPARTMENT', 'COURSE', 'ROLE');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" "BroadcastAudienceType" NOT NULL,
    "audienceBatchId" TEXT,
    "audienceDepartmentId" TEXT,
    "audienceCourseId" TEXT,
    "audienceRole" TEXT,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_templates_collegeId_idx" ON "message_templates"("collegeId");

-- CreateIndex
CREATE INDEX "broadcasts_collegeId_idx" ON "broadcasts"("collegeId");

-- CreateIndex
CREATE INDEX "broadcast_recipients_userId_idx" ON "broadcast_recipients"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcastId_userId_key" ON "broadcast_recipients"("broadcastId", "userId");

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
