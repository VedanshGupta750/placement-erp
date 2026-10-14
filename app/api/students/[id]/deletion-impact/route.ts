import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { collectStudentDeletionImpact } from "@/lib/students/delete";

// What deleting this student would destroy, so the confirm dialog can
// state exact numbers instead of a vague warning. Gated on student.delete
// (not student.view): these counts are only needed to confirm a delete.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.delete");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const scopeWhere = await getStudentScopeWhere(db, session);
  const student = await db.student.findFirst({ where: { id: studentId, ...scopeWhere }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, impact: await collectStudentDeletionImpact(db, [studentId]) });
}

