import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";

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
