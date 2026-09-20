import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

type TargetStatus = "CONFIRMED" | "REJECTED" | "WAITLISTED";
const TARGET_STATUSES = new Set<TargetStatus>(["CONFIRMED", "REJECTED", "WAITLISTED"]);

const AUDIT_ACTION: Record<TargetStatus, string> = {
  CONFIRMED: "event.registration_approved",
  REJECTED: "event.registration_rejected",
  WAITLISTED: "event.registration_waitlisted",
};

const NOTIFY_TITLE: Record<TargetStatus, string> = {
  CONFIRMED: "Registration approved",
  REJECTED: "Registration rejected",
  WAITLISTED: "Moved to waitlist",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; registrationId: string }> }) {
  const session = await requireSession();
  const { id: eventId, registrationId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.manage_registrations");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const rawStatus = body?.status;
  if (typeof rawStatus !== "string" || !TARGET_STATUSES.has(rawStatus as TargetStatus)) {
    return NextResponse.json({ error: "validation_error", message: "status must be one of CONFIRMED, REJECTED, WAITLISTED." }, { status: 400 });
  }
  const status = rawStatus as TargetStatus;

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const registration = await db.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!registration || registration.eventId !== eventId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await db.eventRegistration.update({
    where: { id: registrationId },
    data: { status, respondedAt: new Date(), respondedById: session.userId },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: AUDIT_ACTION[status],
    resourceType: "Event",
    resourceId: eventId,
    after: { studentName: registration.user.name, status },
  });

  await notifyUser(
    db,
    session.collegeId,
    registration.userId,
    "event.registration_status",
    NOTIFY_TITLE[status],
    `Your registration for "${event.title}" is now ${status.toLowerCase()}.`,
    `/events/${eventId}`,
  );

  return NextResponse.json({ ok: true, registration: updated });
}
