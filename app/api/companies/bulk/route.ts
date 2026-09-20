import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

type BulkAction = "change_status" | "add_tag" | "archive";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const companyIds: string[] = Array.isArray(body?.companyIds) ? body.companyIds : [];
  const action: BulkAction = body?.action;
  const payload = body?.payload ?? {};

  if (companyIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one company." }, { status: 400 });
  }
  if (companyIds.length > 500) {
    return NextResponse.json({ error: "validation_error", message: "Bulk actions are limited to 500 companies at a time." }, { status: 400 });
  }

  // Only act on companies this college actually partners with — a bulk
  // action driven from the college's own companies list should never be
  // able to reach into another college's partnership via a crafted id.
  const partnerships = await db.collegePartnership.findMany({ where: { companyId: { in: companyIds } } });
  if (partnerships.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let successCount = 0;

  if (action === "change_status") {
    const status = typeof payload.status === "string" ? payload.status : "";
    if (!["PENDING", "ACTIVE", "PARTNER", "DORMANT"].includes(status)) {
      return NextResponse.json({ error: "validation_error", message: "Invalid status." }, { status: 400 });
    }
    await db.collegePartnership.updateMany({ where: { id: { in: partnerships.map((p) => p.id) } }, data: { status } });
    successCount = partnerships.length;
  } else if (action === "add_tag") {
    const tag = typeof payload.tag === "string" ? payload.tag.trim() : "";
    if (!tag) return NextResponse.json({ error: "validation_error", message: "Tag is required." }, { status: 400 });
    for (const p of partnerships) {
      const company = await prisma.company.findUnique({ where: { id: p.companyId }, select: { tags: true } });
      if (!company || company.tags.includes(tag)) continue;
      await prisma.company.update({ where: { id: p.companyId }, data: { tags: { push: tag } } });
      successCount += 1;
    }
  } else if (action === "archive") {
    try {
      await requirePermission(session, "company.archive");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    await db.collegePartnership.updateMany({ where: { id: { in: partnerships.map((p) => p.id) } }, data: { status: "BLOCKED" } });
    successCount = partnerships.length;
  } else {
    return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
  }

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.bulk_action",
    resourceType: "Company",
    resourceId: null,
    after: { action, companyCount: successCount, payload },
  });

  return NextResponse.json({ ok: true, successCount });
}
