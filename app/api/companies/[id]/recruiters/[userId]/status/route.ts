import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

// Mirrors app/api/students/[id]/account-status/route.ts's suspend/reactivate
// pattern, for the recruiter side.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await requireSession();
  const { id: companyId, userId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const partnership = await db.collegePartnership.findFirst({ where: { companyId } });
  if (!partnership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await prisma.companyUser.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const suspend = body?.suspend === true;
  const nextStatus = suspend ? "SUSPENDED" : "ACTIVE";
  await prisma.companyUser.update({ where: { id: userId }, data: { status: nextStatus } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.recruiter_status_changed",
    resourceType: "Company",
    resourceId: companyId,
    after: { email: user.email, status: nextStatus },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
