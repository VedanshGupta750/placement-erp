import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await requireSession();
  const { id: contactId, docId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const document = await db.contactDocument.findUnique({ where: { id: docId } });
  if (!document || document.contactId !== contactId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.contactDocument.delete({ where: { id: docId } });

  return NextResponse.json({ ok: true });
}
