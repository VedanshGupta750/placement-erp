import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

// Confirms or withdraws a student's placement. This one field decides
// whether they count as placed in every report AND whether they may still
// apply to drives, which is why it has its own permission rather than
// riding on student.edit.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.mark_placed");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const scopeWhere = await getStudentScopeWhere(db, session);
  const student = await db.student.findFirst({
    where: { id: studentId, ...scopeWhere },
    select: { id: true, userId: true, placementConfirmedAt: true },
  });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const placed = body?.placed === true;
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

  await db.student.update({
    where: { id: studentId },
    data: placed
      ? { placementConfirmedAt: new Date(), placementConfirmedById: session.userId, placementConfirmedNote: note }
      : // Cleared together: a withdrawn confirmation shouldn't leave a stale
        // "confirmed by" pointing at someone who no longer stands behind it.
        { placementConfirmedAt: null, placementConfirmedById: null, placementConfirmedNote: null },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: placed ? "student.placement_confirmed" : "student.placement_withdrawn",
    resourceType: "Student",
    resourceId: studentId,
    after: { note, previouslyConfirmed: Boolean(student.placementConfirmedAt) },
  });

  // The student is told, because this is the moment they stop being able to
  // apply to drives — finding that out by hitting a wall would be worse.
  await notifyUser(
    db,
    session.collegeId,
    student.userId,
    placed ? "student.placement_confirmed" : "student.placement_withdrawn",
    placed ? "Your placement has been confirmed" : "Your placement confirmation was withdrawn",
    placed
      ? `Your placement cell has marked you as placed${note ? ` — ${note}` : ""}. Further drive applications may now be limited.`
      : "Your placement cell has withdrawn your placement confirmation. You can apply to drives again.",
    "/profile",
  );

  return NextResponse.json({ ok: true, placed });
}
