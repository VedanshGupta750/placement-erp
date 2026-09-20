// No "server-only" guard — kept usable the same way lib/drives/counters.ts is.
// The Notification row is the canonical in-app history. A PushDelivery row
// is created in the same database client/transaction so a worker can deliver
// Web Push without making the originating request wait on a remote service.
// Untyped `db` for the same reason as lib/applications.ts — unifying the
// tenant-scoped, raw-prisma and $transaction client types here isn't worth
// the TypeScript compiler cost.
export async function notifyUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  collegeId: string,
  userId: string,
  eventType: string,
  title: string,
  body: string,
  link?: string,
) {
  const notification = await db.notification.create({
    data: { collegeId, userId, eventType, channel: "IN_APP", title, body, link, status: "SENT" },
    select: { id: true },
  });
  await db.pushDelivery.create({ data: { collegeId, notificationId: notification.id } });
  return notification;
}

export async function notifyUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  collegeId: string,
  userIds: string[],
  eventType: string,
  title: string,
  body: string,
  link?: string,
) {
  if (userIds.length === 0) return;
  const notifications = await db.notification.createManyAndReturn({
    data: userIds.map((userId) => ({ collegeId, userId, eventType, channel: "IN_APP", title, body, link, status: "SENT" })),
    select: { id: true },
  });
  await db.pushDelivery.createMany({
    data: notifications.map((notification: { id: string }) => ({ collegeId, notificationId: notification.id })),
  });
  return notifications;
}
