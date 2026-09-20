-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "allottedAmount" DECIMAL(14,2),
    "utilizedAmount" DECIMAL(14,2),
    "requestedAmount" DECIMAL(14,2),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_collegeId_idx" ON "budgets"("collegeId");

-- CreateIndex
CREATE INDEX "budgets_collegeId_fiscalYear_idx" ON "budgets"("collegeId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
