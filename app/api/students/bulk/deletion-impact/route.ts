import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { collectStudentDeletionImpact } from "@/lib/students/delete";

// What a bulk delete would destroy. POST rather than GET with ?ids= because
// the bulk limit is 1000 students and 1000 cuids overflow a query string —
// this is a read, but it needs a body.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.delete");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds.slice(0, 1000) : [];
  if (studentIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one student." }, { status: 400 });
  }

  // Scoped the same way the delete itself is, so the dialog can't quote
  // numbers for students the caller isn't allowed to touch.
  const scopeWhere = await getStudentScopeWhere(db, session);
  const students = await db.student.findMany({
    where: { id: { in: studentIds }, ...scopeWhere },
    select: { id: true },
  });

  const impact = await collectStudentDeletionImpact(db, students.map((s: { id: string }) => s.id));
  return NextResponse.json({ ok: true, impact });
}
