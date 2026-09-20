import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";

export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
