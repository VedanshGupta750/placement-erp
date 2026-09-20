import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";

// Suspends or reactivates the student's underlying User account (login
// access) — distinct from Student.placementStatus, which is about
// placement policy, not account access. Same requireNotSelfServiceStudent
// guard as every other admin mutation here.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.edit");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const suspend = body?.suspend === true;

  const student = await db.student.findUnique({ where: { id: studentId }, include: { user: true } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const nextStatus = suspend ? "SUSPENDED" : "ACTIVE";
  await db.user.update({ where: { id: student.userId }, data: { status: nextStatus } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.field_updated",
    resourceType: "Student",
    resourceId: studentId,
    after: { accountStatus: nextStatus },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
