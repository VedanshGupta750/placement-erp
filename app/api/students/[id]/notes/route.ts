import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";

// Internal-only notes — never surfaced to the student themselves (this
// route, and the tab that renders these, only ever appear on the
// TPO-facing /students/[id] page, never on the student's own /profile).
// requireNotSelfServiceStudent matters here specifically: without it, a
// student could POST a "note" on another student via direct API call even
// though the UI never shows them the option.
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

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { body: ["Note can't be empty."] } }, { status: 400 });
  }

  const note = await db.studentNote.create({ data: { studentId, authorId: session.userId, body: text } });
  return NextResponse.json({ ok: true, note });
}
