import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { getEligibleStudentsForEvent } from "@/lib/events/eligibility-runner";

// Communication tab's "Send announcement" affordance — a scoped-to-one-event
// version of the Broadcast pattern (app/api/broadcasts/route.ts): resolve a
// target audience to userId[], fan out IN_APP notifications, and record an
// audit entry that the Communication tab reads back as its announcement log
// (there's no dedicated model for this — the audit trail is the log).
const AUDIENCE_LABEL = {
  REGISTERED: "Registered students",
  WAITLISTED: "Waitlisted students",
  ELIGIBLE: "Eligible students (not yet registered)",
} as const;

const announceSchema = z.object({
  audience: z.enum(["REGISTERED", "WAITLISTED", "ELIGIBLE"]),
  subject: z.string().trim().min(2, "Subject must be at least 2 characters."),
  body: z.string().trim().min(1, "Message can't be empty."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.manage_registrations");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // Tenant-scoped lookup — confirms this event belongs to the caller's
  // college before we touch EventRegistration, which has no collegeId
  // column of its own and must be scoped by hand via the parent event.
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await request.json().catch(() => null);
  const parsed = announceSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { audience, subject, body: message } = parsed.data;

  let userIds: string[] = [];
  if (audience === "REGISTERED") {
    const regs = await db.eventRegistration.findMany({
      where: { eventId, status: { in: ["PENDING", "CONFIRMED"] } },
      select: { userId: true },
    });
    userIds = regs.map((r) => r.userId);
  } else if (audience === "WAITLISTED") {
    const regs = await db.eventRegistration.findMany({ where: { eventId, status: "WAITLISTED" }, select: { userId: true } });
    userIds = regs.map((r) => r.userId);
  } else {
    const [eligibleStudents, registered] = await Promise.all([
      getEligibleStudentsForEvent(db, eventId),
      db.eventRegistration.findMany({ where: { eventId }, select: { userId: true } }),
    ]);
    const registeredIds = new Set(registered.map((r) => r.userId));
    userIds = eligibleStudents.map((s) => s.userId).filter((uid) => !registeredIds.has(uid));
  }

  await notifyUsers(db, session.collegeId, userIds, "event.announcement", subject, message, `/events/${eventId}`);

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "event.announcement_sent",
    resourceType: "Event",
    resourceId: eventId,
    after: { audience, audienceLabel: AUDIENCE_LABEL[audience], subject, recipientCount: userIds.length },
  });

  return NextResponse.json({ ok: true, recipientCount: userIds.length });
}
