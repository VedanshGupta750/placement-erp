-- CreateTable
CREATE TABLE "placement_expenses" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "driveId" TEXT,
    "eventId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_revenues" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "driveId" TEXT,
    "eventId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_expenses_collegeId_idx" ON "placement_expenses"("collegeId");

-- CreateIndex
CREATE INDEX "placement_expenses_driveId_idx" ON "placement_expenses"("driveId");

-- CreateIndex
CREATE INDEX "placement_expenses_eventId_idx" ON "placement_expenses"("eventId");

-- CreateIndex
CREATE INDEX "placement_revenues_collegeId_idx" ON "placement_revenues"("collegeId");

-- CreateIndex
CREATE INDEX "placement_revenues_driveId_idx" ON "placement_revenues"("driveId");

-- CreateIndex
CREATE INDEX "placement_revenues_eventId_idx" ON "placement_revenues"("eventId");

-- AddForeignKey
ALTER TABLE "placement_expenses" ADD CONSTRAINT "placement_expenses_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_expenses" ADD CONSTRAINT "placement_expenses_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "drives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_expenses" ADD CONSTRAINT "placement_expenses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_expenses" ADD CONSTRAINT "placement_expenses_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_revenues" ADD CONSTRAINT "placement_revenues_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_revenues" ADD CONSTRAINT "placement_revenues_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_revenues" ADD CONSTRAINT "placement_revenues_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "drives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_revenues" ADD CONSTRAINT "placement_revenues_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_revenues" ADD CONSTRAINT "placement_revenues_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
