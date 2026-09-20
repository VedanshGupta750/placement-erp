-- CreateEnum
CREATE TYPE "ApplicationFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- CreateTable
CREATE TABLE "drive_notes" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_application_fields" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "ApplicationFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_application_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_field_values" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "application_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drive_notes_driveId_idx" ON "drive_notes"("driveId");

-- CreateIndex
CREATE INDEX "drive_application_fields_driveId_idx" ON "drive_application_fields"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "application_field_values_applicationId_fieldId_key" ON "application_field_values"("applicationId", "fieldId");

-- AddForeignKey
ALTER TABLE "drive_notes" ADD CONSTRAINT "drive_notes_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_notes" ADD CONSTRAINT "drive_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_application_fields" ADD CONSTRAINT "drive_application_fields_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "drives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_field_values" ADD CONSTRAINT "application_field_values_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_field_values" ADD CONSTRAINT "application_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "drive_application_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
