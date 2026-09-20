import { prisma } from "@/lib/db";
import { getVapidConfig, webpush } from "@/lib/push/vapid";

const MAX_ATTEMPTS = 5;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

function safeLink(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function statusCodeOf(error: unknown) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  return typeof error.statusCode === "number" ? error.statusCode : null;
}

function retryDelay(attempt: number) {
  const base = Math.min(30 * 60 * 1000, 15_000 * 2 ** Math.max(0, attempt - 1));
  return base + Math.floor(Math.random() * 5_000);
}

async function processDelivery(id: string) {
  const delivery = await prisma.pushDelivery.findUnique({
    where: { id },
    include: { notification: true },
  });
  if (!delivery || delivery.status !== "PROCESSING") return "skipped" as const;

  const preference = await prisma.notificationPreference.findUnique({
    where: {
      userId_eventType_channel: {
        userId: delivery.notification.userId,
        eventType: delivery.notification.eventType,
        channel: "WEB_PUSH",
      },
    },
    select: { enabled: true },
  });

  if (preference?.enabled === false) {
    await prisma.pushDelivery.update({
      where: { id },
      data: { status: "SKIPPED", processedAt: new Date(), lastError: "preference_disabled" },
    });
    return "skipped" as const;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      collegeId: delivery.collegeId,
      userId: delivery.notification.userId,
      isActive: true,
    },
  });

  if (subscriptions.length === 0) {
    await prisma.pushDelivery.update({
      where: { id },
      data: { status: "SKIPPED", processedAt: new Date(), lastError: "no_active_subscription" },
    });
    return "skipped" as const;
  }

  const payload = JSON.stringify({
    notificationId: delivery.notificationId,
    title: delivery.notification.title,
    body: delivery.notification.body,
    link: safeLink(delivery.notification.link),
    tag: delivery.notification.eventType,
  });

  let sent = 0;
  let transientFailures = 0;
  let lastError = "delivery_failed";

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { TTL: 60 * 60 * 24, urgency: "normal" },
      );
      sent += 1;
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { failureCount: 0, lastUsedAt: new Date() },
      });
    } catch (error) {
      const statusCode = statusCodeOf(error);
      lastError = statusCode ? `push_http_${statusCode}` : "push_transport_error";
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { isActive: false, failureCount: { increment: 1 } },
        });
      } else {
        transientFailures += 1;
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { failureCount: { increment: 1 } },
        });
      }
    }
  }

  if (sent > 0) {
    await prisma.pushDelivery.update({
      where: { id },
      data: { status: "SENT", processedAt: new Date(), lastError: transientFailures > 0 ? "partial_delivery" : null },
    });
    return "sent" as const;
  }

  if (transientFailures > 0 && delivery.attempts < MAX_ATTEMPTS) {
    await prisma.pushDelivery.update({
      where: { id },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(Date.now() + retryDelay(delivery.attempts)),
        lastError,
      },
    });
    return "retry" as const;
  }

  await prisma.pushDelivery.update({
    where: { id },
    data: { status: "FAILED", processedAt: new Date(), lastError },
  });
  return "failed" as const;
}

export async function dispatchPendingPush(limit = 50) {
  if (!getVapidConfig()) {
    return { configured: false, claimed: 0, sent: 0, skipped: 0, retried: 0, failed: 0 };
  }

  await prisma.pushDelivery.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - PROCESSING_TIMEOUT_MS) },
    },
    data: { status: "PENDING", lastError: "processing_timeout" },
  });

  const candidates = await prisma.pushDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 200)),
    select: { id: true },
  });

  const claimed: string[] = [];
  for (const candidate of candidates) {
    const result = await prisma.pushDelivery.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (result.count === 1) claimed.push(candidate.id);
  }

  const summary = { configured: true, claimed: claimed.length, sent: 0, skipped: 0, retried: 0, failed: 0 };
  for (const id of claimed) {
    const result = await processDelivery(id);
    if (result === "sent") summary.sent += 1;
    if (result === "skipped") summary.skipped += 1;
    if (result === "retry") summary.retried += 1;
    if (result === "failed") summary.failed += 1;
  }
  return summary;
}

