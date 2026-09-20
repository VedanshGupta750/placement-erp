import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

// Bulk approve/reject — used by the "approve all shown" action on the
// today's-top-10 review queue. Only ever updates rows that are still
// PENDING and belong to this college (getTenantDb injects collegeId; the
// PENDING filter means re-clicking after a partial failure never re-
// approves something already decided).
export async function POST(request: Request) {
  const session = await requireSession();

  try {
    await requirePermission(session, "external_job.review");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const reviewIds = Array.isArray(body?.reviewIds) ? body.reviewIds.filter((v: unknown) => typeof v === "string") : [];
  const action = body?.action;
  if (reviewIds.length === 0 || (action !== "APPROVED" && action !== "REJECTED")) {
    return NextResponse.json({ error: "validation_error", message: "reviewIds[] and action (APPROVED/REJECTED) are required." }, { status: 400 });
  }

  const db = getTenantDb(session.collegeId);
  const result = await db.externalJobReview.updateMany({
    where: { id: { in: reviewIds }, status: "PENDING" },
    data: { status: action, reviewedById: session.userId, reviewedAt: new Date() },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: action === "APPROVED" ? "external_job.bulk_approved" : "external_job.bulk_rejected",
    resourceType: "ExternalJobReview",
    after: { count: result.count },
  });

  return NextResponse.json({ successCount: result.count });
}
