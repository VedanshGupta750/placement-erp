import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { clearLoginAttempts } from "@/lib/auth/rate-limit";

// Admin-mediated password reset — this app has no email provider wired up
// (see lib/people/invite-form.tsx's own comment), so there's no
// self-service "email me a reset link" flow. This is the real substitute:
// staff generates a fresh temporary password here, shown once in the
// response for them to relay to the student directly (same pattern
// already used for the invite flow's tempPassword).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const student = await db.student.findUnique({ where: { id: studentId }, include: { user: true } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await db.user.update({ where: { id: student.userId }, data: { passwordHash, mustChangePassword: true } });
  clearLoginAttempts(student.user.email);

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.password_reset",
    resourceType: "Student",
    resourceId: studentId,
  });

  return NextResponse.json({ ok: true, tempPassword });
}
