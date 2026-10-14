import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { collectStudentDeletionImpact, deleteStudentsCompletely } from "@/lib/students/delete";
import { Prisma } from "@/lib/generated/prisma/client";

const SENSITIVE_FIELDS = new Set(["aggregate", "tenthScore", "twelfthScore", "diplomaScore"]);
const EDITABLE_FIELDS = new Set([
  ...SENSITIVE_FIELDS,
  "placementStatus",
  "tags",
  "eligibleForPlacements",
  "hasPlacementAccess",
  "interestedInJobs",
  "interestedInInternships",
]);

// Partial field update for a student's profile — CGPA/board scores,
// placement status, and tags. Editing any sensitive academic field
// additionally requires student.view_sensitive, not just student.edit.
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "validation_error", message: "Invalid body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (EDITABLE_FIELDS.has(key)) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "validation_error", message: "No editable fields provided." }, { status: 400 });
  }

  const touchesSensitive = Object.keys(updates).some((k) => SENSITIVE_FIELDS.has(k));
  if (touchesSensitive) {
    try {
      await requirePermission(session, "student.view_sensitive");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
  }

  const before = await db.student.findUnique({
    where: { id: studentId },
    select: Object.fromEntries(Object.keys(updates).map((k) => [k, true])),
  });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await db.student.update({ where: { id: studentId }, data: updates });

  // Tag changes get their own more specific audit action (added vs
  // removed); everything else is a generic field-updated entry.
  if ("tags" in updates) {
    const beforeTags = new Set((before as { tags?: string[] }).tags ?? []);
    const afterTags = new Set((updates.tags as string[]) ?? []);
    const added = [...afterTags].filter((t) => !beforeTags.has(t));
    const removed = [...beforeTags].filter((t) => !afterTags.has(t));
    for (const tag of added) {
      await recordAudit(db, {
        collegeId: session.collegeId,
        actorId: session.userId,
        action: "student.tag_added",
        resourceType: "Student",
        resourceId: studentId,
        after: { tag },
      });
    }
    for (const tag of removed) {
      await recordAudit(db, {
        collegeId: session.collegeId,
        actorId: session.userId,
        action: "student.tag_removed",
        resourceType: "Student",
        resourceId: studentId,
        after: { tag },
      });
    }
    const otherFields = Object.keys(updates).filter((k) => k !== "tags");
    if (otherFields.length === 0) return NextResponse.json({ ok: true, student: updated });
  }

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.field_updated",
    resourceType: "Student",
    resourceId: studentId,
    after: { changes: Object.fromEntries(Object.keys(updates).filter((k) => k !== "tags").map((k) => [k, { before: (before as Record<string, unknown>)[k], after: updates[k] }])) },
  });

  return NextResponse.json({ ok: true, student: updated });
}

// Hard-deletes the student and their login account. See lib/students/delete.ts
// for what cascades, what is reassigned, and why the User row is the one
// that has to go.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    // student.delete, not student.edit — a role that maintains the roster
    // shouldn't be able to erase a record just because it can correct one.
    await requirePermission(session, "student.delete");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // Row-level scope applies here as it does to every other student
  // mutation: a Department Coordinator granted student.delete could
  // otherwise delete outside their own department by calling this directly.
  const scopeWhere = await getStudentScopeWhere(db, session);
  const student = await db.student.findFirst({
    where: { id: studentId, ...scopeWhere },
    select: { id: true, userId: true, enrollmentNumber: true, user: { select: { name: true, email: true } } },
  });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Recorded BEFORE the delete — the counts are unreachable afterwards, and
  // the audit entry is the only remaining trace of what was destroyed.
  const impact = await collectStudentDeletionImpact(db, [studentId]);

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.deleted",
    resourceType: "Student",
    resourceId: studentId,
    after: {
      name: student.user.name,
      email: student.user.email,
      enrollmentNumber: student.enrollmentNumber,
      ...impact,
    },
  });

  try {
    await deleteStudentsCompletely(db, [{ id: student.id, userId: student.userId }], session.userId);
  } catch (e) {
    // P2003 = foreign key constraint. Means this student holds a row in a
    // required relation the helper doesn't know about yet; report it rather
    // than 500, and the audit entry above records the attempt.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        {
          error: "delete_blocked",
          message:
            "This student still has records elsewhere that must be removed first. Suspend the account instead, and report this so the delete can be extended.",
        },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true, name: student.user.name });
}
