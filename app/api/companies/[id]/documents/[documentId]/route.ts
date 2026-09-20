import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const session = await requireSession();
  const { id: companyId, documentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // companyDocument is tenant-scoped (has its own collegeId) so
  // getTenantDb already keeps this to the caller's college — still verify
  // the id belongs to the requested company before deleting.
  const doc = await db.companyDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.companyId !== companyId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.companyDocument.delete({ where: { id: documentId } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.document_deleted",
    resourceType: "Company",
    resourceId: companyId,
    after: { fileName: doc.fileName },
  });

  return NextResponse.json({ ok: true });
}
