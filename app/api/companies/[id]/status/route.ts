import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import type { PartnershipStatus } from "@/lib/generated/prisma/client";

const VALID_STATUSES = new Set<string>(["PENDING", "ACTIVE", "PARTNER", "DORMANT", "BLOCKED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: companyId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const rawStatus = body?.status;
  if (typeof rawStatus !== "string" || !VALID_STATUSES.has(rawStatus)) {
    return NextResponse.json({ error: "validation_error", message: "Invalid status." }, { status: 400 });
  }
  const status = rawStatus as PartnershipStatus;

  // Marking a company Blacklisted is a heavier action than the other
  // statuses — require company.archive on top of company.edit, same
  // "extra gate for the destructive action" pattern as event cancel vs
  // event edit.
  if (status === "BLOCKED") {
    try {
      await requirePermission(session, "company.archive");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
  }

  const partnership = await db.collegePartnership.findFirst({ where: { companyId } });
  if (!partnership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await db.collegePartnership.update({
    where: { id: partnership.id },
    data: { status, connectedAt: partnership.connectedAt ?? (status !== "PENDING" ? new Date() : undefined) },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.status_changed",
    resourceType: "Company",
    resourceId: companyId,
    after: { status },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
