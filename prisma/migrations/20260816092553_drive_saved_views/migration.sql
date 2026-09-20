-- CreateTable
CREATE TABLE "drive_saved_views" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drive_saved_views_collegeId_userId_idx" ON "drive_saved_views"("collegeId", "userId");

-- AddForeignKey
ALTER TABLE "drive_saved_views" ADD CONSTRAINT "drive_saved_views_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_saved_views" ADD CONSTRAINT "drive_saved_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
