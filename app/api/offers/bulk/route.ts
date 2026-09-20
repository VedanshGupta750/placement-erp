import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { notifyUser } from "@/lib/notify";

// Bulk counterpart to PATCH /api/drives/[id]/offers/[offerId] (action=issue)
// — a drive that selected 20 students at once shouldn't need 20 individual
// clicks to get every draft offer out the door.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "offer.issue");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const offerIds: string[] = Array.isArray(body?.offerIds) ? body.offerIds : [];
  if (offerIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one offer." }, { status: 400 });
  }
  if (offerIds.length > 500) {
    return NextResponse.json({ error: "validation_error", message: "Bulk issuing is limited to 500 offers at a time." }, { status: 400 });
  }

  const offers = await db.offer.findMany({
    where: { id: { in: offerIds }, status: "DRAFT" },
    include: { student: { select: { userId: true } }, drive: { select: { title: true } } },
  });
  const skipped = offerIds.length - offers.length;
  if (offers.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "None of the selected offers are drafts." }, { status: 400 });
  }

  await db.offer.updateMany({ where: { id: { in: offers.map((o: { id: string }) => o.id) } }, data: { status: "ISSUED", issuedAt: new Date() } });

  await Promise.all(
    offers.map((o: { student: { userId: string }; drive: { title: string } }) =>
      notifyUser(db, session.collegeId, o.student.userId, "offer.issued", "You've received an offer", o.drive.title, "/offers"),
    ),
  );

  return NextResponse.json({ ok: true, successCount: offers.length, skipped });
}
