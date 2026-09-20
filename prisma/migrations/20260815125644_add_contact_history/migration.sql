-- CreateTable
CREATE TABLE "contact_history_entries" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_history_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contact_history_entries" ADD CONSTRAINT "contact_history_entries_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_history_entries" ADD CONSTRAINT "contact_history_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
