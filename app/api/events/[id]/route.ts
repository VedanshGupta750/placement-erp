import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { updateEventSchema } from "@/lib/validators/event";

// Full event detail, used to pre-fill the Create/Edit wizard in edit mode.
// Gated on event.edit (not event.view) since it's exclusively an
// edit-flow endpoint — the read-only event detail page fetches its own
// data directly rather than through this route.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({
    where: { id },
    include: { speaker: true },
  });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ event });
}

// Accepts three shapes:
//   - {action:"publish"}            → sets publishedAt (gated on event.publish)
//   - {action:"cancel", reason}     → sets cancelledAt + cancelReason (gated on event.publish)
//   - anything else                 → a field update parsed by updateEventSchema (gated on event.edit)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  if (body?.action === "publish") {
    try {
      await requirePermission(session, "event.publish");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const event = await db.event.update({ where: { id }, data: { publishedAt: new Date() } });
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "event.published",
      resourceType: "Event",
      resourceId: event.id,
      after: { title: event.title, publishedAt: event.publishedAt },
    });
    return NextResponse.json({ ok: true, event });
  }

  if (body?.action === "cancel") {
    try {
      await requirePermission(session, "event.publish");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
    const event = await db.event.update({
      where: { id },
      data: { cancelledAt: new Date(), cancelReason: reason || undefined },
    });
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "event.cancelled",
      resourceType: "Event",
      resourceId: event.id,
      after: { title: event.title, cancelledAt: event.cancelledAt, cancelReason: event.cancelReason },
      reason,
    });
    return NextResponse.json({ ok: true, event });
  }

  try {
    await requirePermission(session, "event.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const event = await db.event.update({
    where: { id },
    data: {
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.organizerLabel !== undefined ? { organizerLabel: data.organizerLabel } : {}),
      ...(data.mode !== undefined ? { mode: data.mode } : {}),
      ...(data.venue !== undefined ? { venue: data.venue } : {}),
      ...(data.meetingUrl !== undefined ? { meetingUrl: data.meetingUrl } : {}),
      ...(data.startAt !== undefined ? { startAt: data.startAt ? new Date(data.startAt) : null } : {}),
      ...(data.endAt !== undefined ? { endAt: data.endAt ? new Date(data.endAt) : null } : {}),
      ...(data.registrationOpensAt !== undefined ? { registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : null } : {}),
      ...(data.registrationClosesAt !== undefined ? { registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : null } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.approvalRequired !== undefined ? { approvalRequired: data.approvalRequired } : {}),
      ...(data.eligibleBatchIds !== undefined ? { eligibleBatchIds: data.eligibleBatchIds } : {}),
      ...(data.eligibleDepartmentIds !== undefined ? { eligibleDepartmentIds: data.eligibleDepartmentIds } : {}),
      ...(data.speakerId !== undefined ? { speakerId: data.speakerId } : {}),
      ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
      ...(data.driveId !== undefined ? { driveId: data.driveId } : {}),
      ...(data.certificateEnabled !== undefined ? { certificateEnabled: data.certificateEnabled } : {}),
      ...(data.feedbackEnabled !== undefined ? { feedbackEnabled: data.feedbackEnabled } : {}),
    },
  });

  return NextResponse.json({ ok: true, event });
}
