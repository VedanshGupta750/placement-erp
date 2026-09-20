import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createRevenueSchema } from "@/lib/validators/finance";
import { recordAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "finance.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createRevenueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.driveId) {
    const drive = await db.drive.findUnique({ where: { id: parsed.data.driveId }, select: { id: true } });
    if (!drive) return NextResponse.json({ error: "validation_error", message: "Drive not found." }, { status: 400 });
  }
  if (parsed.data.eventId) {
    const event = await db.event.findUnique({ where: { id: parsed.data.eventId }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "validation_error", message: "Event not found." }, { status: 400 });
  }
  // Company is global — confirm the caller's college actually has a live
  // partnership with it before letting them attribute revenue to it
  // (same check as app/api/companies/[id]/recruiters/route.ts).
  if (parsed.data.companyId) {
    const partnership = await db.collegePartnership.findFirst({ where: { companyId: parsed.data.companyId } });
    if (!partnership) return NextResponse.json({ error: "validation_error", message: "Company not found." }, { status: 400 });
  }

  const revenue = await db.placementRevenue.create({
    data: {
      collegeId: session.collegeId,
      source: parsed.data.source,
      description: parsed.data.description,
      amount: parsed.data.amount,
      receivedDate: new Date(parsed.data.receivedDate),
      companyId: parsed.data.companyId || null,
      driveId: parsed.data.driveId || null,
      eventId: parsed.data.eventId || null,
      recordedById: session.userId,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "finance.revenue_recorded",
    resourceType: "PlacementRevenue",
    resourceId: revenue.id,
    after: { source: revenue.source, amount: parsed.data.amount },
  });

  return NextResponse.json({ ok: true, id: revenue.id });
}
