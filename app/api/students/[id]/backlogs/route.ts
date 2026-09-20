import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

// Creates a subject-level backlog row AND increments the student's
// denormalised liveBacklogs count in the same request, so the two never
// drift apart — the eligibility engine (lib/eligibility.ts) reads only the
// count, never the detail rows.
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
  const subjectName = typeof body?.subjectName === "string" ? body.subjectName.trim() : "";
  if (!subjectName) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { subjectName: ["Subject name is required."] } }, { status: 400 });
  }

  const [backlog] = await db.$transaction([
    db.studentBacklog.create({
      data: {
        studentId,
        subjectName,
        subjectCode: typeof body.subjectCode === "string" && body.subjectCode.trim() ? body.subjectCode.trim() : undefined,
        semester: typeof body.semester === "number" ? body.semester : undefined,
        attempt: typeof body.attempt === "number" && body.attempt > 0 ? body.attempt : 1,
      },
    }),
    db.student.update({ where: { id: studentId }, data: { liveBacklogs: { increment: 1 } } }),
  ]);

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.backlog_added",
    resourceType: "Student",
    resourceId: studentId,
    after: { subjectName, semester: backlog.semester },
  });

  return NextResponse.json({ ok: true, backlog });
}
