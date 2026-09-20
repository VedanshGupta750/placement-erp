// `db` is intentionally untyped (`any`) — tenant-scoped client, see the
// documented convention in lib/applications.ts / lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logContactHistory(db: any, contactId: string, actorId: string, action: string) {
  await db.contactHistoryEntry.create({ data: { contactId, actorId, action } });
}
