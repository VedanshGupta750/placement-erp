-- AlterEnum
ALTER TYPE "ContactCommunicationType" ADD VALUE 'MESSAGE';

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "lastReadAt" TIMESTAMP(3),
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSizeBytes" INTEGER,
ADD COLUMN     "attachmentUrl" TEXT;
