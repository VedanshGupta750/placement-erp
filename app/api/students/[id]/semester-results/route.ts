import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Upserts a single semester's SGPA (unique on studentId+semester) — used to
// build the Academic tab's semester-wise timeline.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.edit");
    await requirePermission(session, "student.view_sensitive");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const semester = Number(body?.semester);
  const sgpa = Number(body?.sgpa);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { semester: ["Semester must be between 1 and 12."] } }, { status: 400 });
  }
  if (!Number.isFinite(sgpa) || sgpa < 0 || sgpa > 10) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { sgpa: ["SGPA must be between 0 and 10."] } }, { status: 400 });
  }
  const credits = Number.isFinite(Number(body?.credits)) ? Number(body.credits) : undefined;

  const result = await db.studentSemesterResult.upsert({
    where: { studentId_semester: { studentId, semester } },
    create: { studentId, semester, sgpa, credits },
    update: { sgpa, credits },
  });

  return NextResponse.json({ ok: true, result });
}
