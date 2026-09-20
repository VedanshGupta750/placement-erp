import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createOfferSchema } from "@/lib/validators/offer";
import { recomputeDriveCounters } from "@/lib/drives/counters";

// TPO/Placement Coordinator issues an offer against a SELECTED application.
// Starts in DRAFT — a separate PATCH .../offers/[offerId] moves it to ISSUED,
// at which point the student can accept/decline it (see app/api/offers/[id]).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "offer.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const application = await db.application.findUnique({
    where: { id: data.applicationId, driveId },
    select: { id: true, studentId: true, driveId: true, positionId: true, status: true, offer: { select: { id: true } } },
  });
  if (!application) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (application.offer) return NextResponse.json({ error: "offer_exists", message: "This application already has an offer." }, { status: 409 });

  const offer = await db.offer.create({
    data: {
      collegeId: session.collegeId,
      applicationId: application.id,
      studentId: application.studentId,
      driveId,
      positionId: application.positionId,
      offerType: data.offerType,
      status: "DRAFT",
      totalCompensation: data.totalCompensation,
      fixedCompensation: data.fixedCompensation,
      variableCompensation: data.variableCompensation,
      stipend: data.stipend,
      joiningBonus: data.joiningBonus,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      offerDate: new Date(),
    },
  });
  await recomputeDriveCounters(db, driveId);

  return NextResponse.json({ ok: true, id: offer.id });
}
