import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

// Marks a backlog cleared and moves the count from liveBacklogs to
// closedBacklogs in the same request — same drift-prevention rationale as
// the POST route.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; backlogId: string }> }) {
  const session = await requireSession();
  const { id: studentId, backlogId } = await params;
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

  const backlog = await db.studentBacklog.findUnique({ where: { id: backlogId } });
  if (!backlog || backlog.studentId !== studentId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (backlog.status === "CLEARED") return NextResponse.json({ ok: true, backlog });

  const [updated] = await db.$transaction([
    db.studentBacklog.update({ where: { id: backlogId }, data: { status: "CLEARED", clearedAt: new Date() } }),
    db.student.update({
      where: { id: studentId },
      data: { liveBacklogs: { decrement: 1 }, closedBacklogs: { increment: 1 } },
    }),
  ]);

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.backlog_cleared",
    resourceType: "Student",
    resourceId: studentId,
    after: { subjectName: backlog.subjectName },
  });

  return NextResponse.json({ ok: true, backlog: updated });
}
