/*
  Warnings:

  - You are about to drop the `post_registrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `posts` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('EXPERT_SESSION', 'WORKSHOP', 'COMPETITION', 'HACKATHON', 'WEBINAR', 'CAREER_FAIR', 'PRE_PLACEMENT_TALK', 'ASSESSMENT', 'TRAINING', 'ALUMNI_SESSION', 'COMPANY_SESSION', 'GENERAL');

-- CreateEnum
CREATE TYPE "EventMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventAttendanceMethod" AS ENUM ('QR', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "EventFileCategory" AS ENUM ('BROCHURE', 'AGENDA', 'SPEAKER_PPT', 'ATTENDANCE_SHEET', 'CERTIFICATE_TEMPLATE', 'RECORDING', 'PHOTO', 'FEEDBACK_REPORT', 'OTHER');

-- DropForeignKey
ALTER TABLE "post_registrations" DROP CONSTRAINT "post_registrations_postId_fkey";

-- DropForeignKey
ALTER TABLE "post_registrations" DROP CONSTRAINT "post_registrations_userId_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_authorId_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_collegeId_fkey";

-- DropTable
DROP TABLE "post_registrations";

-- DropTable
DROP TABLE "posts";

-- DropEnum
DROP TYPE "PostType";

-- CreateTable
CREATE TABLE "event_speakers" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "organization" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "linkedinUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "organizerLabel" TEXT,
    "mode" "EventMode" NOT NULL DEFAULT 'OFFLINE',
    "venue" TEXT,
    "meetingUrl" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityLogic" JSONB,
    "eligibleBatchIds" TEXT[],
    "eligibleDepartmentIds" TEXT[],
    "speakerId" TEXT,
    "companyId" TEXT,
    "driveId" TEXT,
    "certificateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "feedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendances" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "method" "EventAttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "markedById" TEXT,

    CONSTRAINT "event_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_feedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "answers" JSONB,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_files" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" "EventFileCategory" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_certificates" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,

    CONSTRAINT "event_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_speakers_collegeId_idx" ON "event_speakers"("collegeId");

-- CreateIndex
CREATE INDEX "events_collegeId_idx" ON "events"("collegeId");

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");

-- CreateIndex
CREATE INDEX "event_registrations_eventId_idx" ON "event_registrations"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_userId_key" ON "event_registrations"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_attendances_eventId_idx" ON "event_attendances"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendances_eventId_userId_key" ON "event_attendances"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_feedback_eventId_idx" ON "event_feedback"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_feedback_eventId_userId_key" ON "event_feedback"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_files_eventId_idx" ON "event_files"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_certificates_code_key" ON "event_certificates"("code");

-- CreateIndex
CREATE INDEX "event_certificates_eventId_idx" ON "event_certificates"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_certificates_eventId_userId_key" ON "event_certificates"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_speakers" ADD CONSTRAINT "event_speakers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "event_speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "drives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendances" ADD CONSTRAINT "event_attendances_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendances" ADD CONSTRAINT "event_attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_certificates" ADD CONSTRAINT "event_certificates_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_certificates" ADD CONSTRAINT "event_certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
