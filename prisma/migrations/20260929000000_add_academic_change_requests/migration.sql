-- CreateTable
CREATE TABLE "academic_change_requests" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION,
    "requestedValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_change_requests_studentId_idx" ON "academic_change_requests"("studentId");

-- CreateIndex
CREATE INDEX "academic_change_requests_collegeId_status_idx" ON "academic_change_requests"("collegeId", "status");

-- AddForeignKey
ALTER TABLE "academic_change_requests" ADD CONSTRAINT "academic_change_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_change_requests" ADD CONSTRAINT "academic_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
