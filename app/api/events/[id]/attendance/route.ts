import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.mark_attendance");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const present = body?.present;
  if (typeof userId !== "string" || typeof present !== "boolean") {
    return NextResponse.json({ error: "validation_error", message: "userId and present are required." }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const registration = await db.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId } },
    include: { user: { select: { name: true } } },
  });
  if (!registration) return NextResponse.json({ error: "not_registered" }, { status: 404 });

  const attendance = await db.eventAttendance.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, checkInAt: present ? new Date() : null, method: "MANUAL", markedById: session.userId },
    update: { checkInAt: present ? new Date() : null, method: "MANUAL", markedById: session.userId },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "event.attendance_marked",
    resourceType: "Event",
    resourceId: eventId,
    after: { studentName: registration.user.name, present },
  });

  return NextResponse.json({ ok: true, attendance });
}
