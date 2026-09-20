import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { clearLoginAttempts } from "@/lib/auth/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
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

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.companyUser.update({ where: { id: userId }, data: { passwordHash } });
  clearLoginAttempts(`employer:${user.email}`);

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.recruiter_password_reset",
    resourceType: "Company",
    resourceId: companyId,
    after: { email: user.email },
  });

  return NextResponse.json({ ok: true, tempPassword });
}
