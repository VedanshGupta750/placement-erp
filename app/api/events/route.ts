import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { createEventSchema } from "@/lib/validators/event";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  // Publishing on create requires event.publish, not just event.create —
  // same gate the dedicated PATCH {action:"publish"} path uses.
  if (data.publish) {
    try {
      await requirePermission(session, "event.publish");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
  }

  const event = await db.event.create({
    data: {
      collegeId: session.collegeId,
      createdById: session.userId,
      category: data.category,
      title: data.title,
      description: data.description,
      organizerLabel: data.organizerLabel,
      mode: data.mode,
      venue: data.venue,
      meetingUrl: data.meetingUrl,
      startAt: data.startAt ? new Date(data.startAt) : undefined,
      endAt: data.endAt ? new Date(data.endAt) : undefined,
      registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : undefined,
      registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : undefined,
      capacity: data.capacity,
      approvalRequired: data.approvalRequired,
      eligibleBatchIds: data.eligibleBatchIds ?? [],
      eligibleDepartmentIds: data.eligibleDepartmentIds ?? [],
      speakerId: data.speakerId,
      companyId: data.companyId,
      driveId: data.driveId,
      certificateEnabled: data.certificateEnabled,
      feedbackEnabled: data.feedbackEnabled,
      publishedAt: data.publish ? new Date() : undefined,
    },
  });

  if (data.publish) {
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "event.published",
      resourceType: "Event",
      resourceId: event.id,
      after: { title: event.title, publishedAt: event.publishedAt },
    });
  }

  return NextResponse.json({ ok: true, id: event.id });
}
