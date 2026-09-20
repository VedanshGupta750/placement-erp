import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { notifyUser } from "@/lib/notify";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Capacity takes priority over approval: a full event waitlists even an
  // otherwise-auto-approved registrant. Below capacity, approvalRequired
  // gates whether the registrant starts CONFIRMED or PENDING (a TPO then
  // approves/rejects/waitlists via the Registrations tab).
  let status: "CONFIRMED" | "PENDING" | "WAITLISTED" = event.approvalRequired ? "PENDING" : "CONFIRMED";
  if (event.capacity != null) {
    const confirmedCount = await db.eventRegistration.count({ where: { eventId, status: "CONFIRMED" } });
    if (confirmedCount >= event.capacity) status = "WAITLISTED";
  }

  await db.eventRegistration.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    create: { eventId, userId: session.userId, status },
    update: {},
  });

  const STATUS_COPY: Record<typeof status, { title: string; body: string }> = {
    CONFIRMED: { title: `Registered for ${event.title}`, body: `You're registered for "${event.title}".` },
    PENDING: { title: `Registration pending for ${event.title}`, body: `Your registration for "${event.title}" is awaiting approval.` },
    WAITLISTED: { title: `Waitlisted for ${event.title}`, body: `"${event.title}" is at capacity — you've been added to the waitlist.` },
  };

  // Immediate in-app confirmation — no email/SMS provider exists in this
  // app, so this is the only receipt the student gets.
  await notifyUser(
    db,
    session.collegeId,
    session.userId,
    "event.registration_confirmed",
    STATUS_COPY[status].title,
    STATUS_COPY[status].body,
    `/events/${eventId}`,
  );

  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  await db.eventRegistration.deleteMany({ where: { eventId, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
