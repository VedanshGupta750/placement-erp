import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getVapidConfig } from "@/lib/push/vapid";

const subscriptionSchema = z.object({
  endpoint: z.url().max(4096).refine((value) => value.startsWith("https://"), "Push endpoint must use HTTPS."),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256),
  }),
  deviceName: z.string().trim().min(1).max(80).optional(),
});

const removeSchema = z.object({ endpoint: z.url().max(4096) });

export async function GET() {
  const session = await requireSession();
  const config = getVapidConfig();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { collegeId: session.collegeId, userId: session.userId, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({
    configured: Boolean(config),
    publicKey: config?.publicKey ?? null,
    subscriptions,
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const config = getVapidConfig();
  if (!config) {
    return NextResponse.json({ error: "not_configured", message: "Push notifications are not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;
  const deviceName = parsed.data.deviceName || "This device";
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: parsed.data.endpoint }, select: { id: true } });

  const subscription = existing
    ? await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          collegeId: session.collegeId,
          userId: session.userId,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          userAgent,
          deviceName,
          vapidKeyId: config.keyId,
          isActive: true,
          failureCount: 0,
        },
        select: { id: true, deviceName: true },
      })
    : await prisma.pushSubscription.create({
        data: {
          collegeId: session.collegeId,
          userId: session.userId,
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          userAgent,
          deviceName,
          vapidKeyId: config.keyId,
        },
        select: { id: true, deviceName: true },
      });

  return NextResponse.json({ ok: true, subscription });
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  const body = await request.json().catch(() => null);
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  await prisma.pushSubscription.updateMany({
    where: {
      collegeId: session.collegeId,
      userId: session.userId,
      endpoint: parsed.data.endpoint,
    },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}

