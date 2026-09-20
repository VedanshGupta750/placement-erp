import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { notifyUser } from "@/lib/notify";

// TPO/Placement Coordinator side of the offer lifecycle: DRAFT -> ISSUED
// (the student then accepts/declines via app/api/offers/[id]), and later
// JOINING_PENDING -> JOINED once the student has actually joined.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; offerId: string }> }) {
  const session = await requireSession();
  const { id: driveId, offerId } = await params;
  const db = getTenantDb(session.collegeId);

  const { action } = await request.json().catch(() => ({}));

  if (action === "issue") {
    try {
      await requirePermission(session, "offer.issue");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const offer = await db.offer.findUnique({ where: { id: offerId, driveId }, include: { student: { select: { userId: true } }, drive: { select: { title: true } } } });
    if (!offer || offer.status !== "DRAFT") {
      return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
    }
    await db.offer.update({ where: { id: offerId }, data: { status: "ISSUED", issuedAt: new Date() } });
    await notifyUser(db, session.collegeId, offer.student.userId, "offer.issued", "You've received an offer", offer.drive.title, "/offers");
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_joined" || action === "mark_did_not_join") {
    try {
      await requirePermission(session, "offer.mark_joined");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const offer = await db.offer.findUnique({ where: { id: offerId, driveId } });
    if (!offer || !["ACCEPTED", "JOINING_PENDING"].includes(offer.status)) {
      return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
    }
    const joined = action === "mark_joined";
    await db.offer.update({ where: { id: offerId }, data: { status: joined ? "JOINED" : "DID_NOT_JOIN" } });
    await db.joiningRecord.upsert({
      where: { offerId },
      create: {
        collegeId: session.collegeId,
        offerId,
        joiningStatus: joined ? "JOINED" : "DID_NOT_JOIN",
        actualJoiningDate: joined ? new Date() : null,
        verifiedAt: new Date(),
        verifiedById: session.userId,
      },
      update: { joiningStatus: joined ? "JOINED" : "DID_NOT_JOIN", actualJoiningDate: joined ? new Date() : null, verifiedAt: new Date(), verifiedById: session.userId },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
