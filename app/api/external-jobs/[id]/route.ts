import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

// Approve or reject a single external-job review candidate. This only
// ever touches THIS college's ExternalJobReview row — the underlying
// ExternalJobPosting is shared/global and never modified here (see
// prisma/schema.prisma's comment on both models).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  try {
    await requirePermission(session, "external_job.review");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "APPROVED" && action !== "REJECTED") {
    return NextResponse.json({ error: "validation_error", message: "action must be APPROVED or REJECTED." }, { status: 400 });
  }

  const db = getTenantDb(session.collegeId);
  const review = await db.externalJobReview.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await db.externalJobReview.update({
    where: { id },
    data: { status: action, reviewedById: session.userId, reviewedAt: new Date() },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: action === "APPROVED" ? "external_job.approved" : "external_job.rejected",
    resourceType: "ExternalJobReview",
    resourceId: id,
  });

  return NextResponse.json({ review: updated });
}
