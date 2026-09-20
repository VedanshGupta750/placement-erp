import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { recordAudit } from "@/lib/audit";
import { deriveEventStatus } from "@/lib/events/status";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "checkin" && action !== "checkout") {
    return NextResponse.json({ error: "validation_error", message: "action must be checkin or checkout." }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const registration = await db.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId: session.userId } },
  });
  if (!registration || registration.status !== "CONFIRMED") {
    return NextResponse.json({ error: "not_registered", message: "You're not registered for this event." }, { status: 403 });
  }

  const existing = await db.eventAttendance.findUnique({ where: { eventId_userId: { eventId, userId: session.userId } } });

  if (action === "checkin") {
    if (existing?.checkInAt) {
      return NextResponse.json({ ok: true, attendance: existing });
    }
    const status = deriveEventStatus(event);
    if (status !== "LIVE") {
      return NextResponse.json({ error: "not_live", message: "Check-in opens once the event goes live." }, { status: 409 });
    }

    const attendance = await db.eventAttendance.upsert({
      where: { eventId_userId: { eventId, userId: session.userId } },
      create: { eventId, userId: session.userId, checkInAt: new Date(), method: "QR" },
      update: { checkInAt: new Date(), method: "QR" },
    });

    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "event.attendance_marked",
      resourceType: "Event",
      resourceId: eventId,
      after: { userId: session.userId, method: "QR", selfCheckin: true },
    });

    return NextResponse.json({ ok: true, attendance });
  }

  // checkout
  if (!existing?.checkInAt) {
    return NextResponse.json({ error: "not_checked_in", message: "You need to check in first." }, { status: 409 });
  }
  if (existing.checkOutAt) {
    return NextResponse.json({ ok: true, attendance: existing });
  }

  const attendance = await db.eventAttendance.update({
    where: { eventId_userId: { eventId, userId: session.userId } },
    data: { checkOutAt: new Date() },
  });

  return NextResponse.json({ ok: true, attendance });
}
