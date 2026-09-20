import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const session = await requireSession();
  const { id: studentId, documentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.edit");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const document = await db.studentDocument.findUnique({ where: { id: documentId } });
  if (!document || document.studentId !== studentId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.studentDocument.delete({ where: { id: documentId } });
  return NextResponse.json({ ok: true });
}

// Marks a document verified — a lightweight TPO sign-off, not a re-upload.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const session = await requireSession();
  const { id: studentId, documentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.edit");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const document = await db.studentDocument.findUnique({ where: { id: documentId } });
  if (!document || document.studentId !== studentId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await db.studentDocument.update({
    where: { id: documentId },
    data: { verifiedAt: new Date(), verifiedById: session.userId },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.document_verified",
    resourceType: "Student",
    resourceId: studentId,
    after: { fileName: document.fileName },
  });

  return NextResponse.json({ ok: true, document: updated });
}
