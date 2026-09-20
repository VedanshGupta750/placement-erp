import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { updateContactSchema, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";
import { logContactHistory } from "@/lib/contacts/history";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const before = await db.contact.findUnique({ where: { id }, select: { relationshipStage: true, ownerId: true, isActive: true } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.contact.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      contactType: parsed.data.contactType || undefined,
      companyId: parsed.data.companyId || undefined,
      designation: parsed.data.designation || undefined,
      department: parsed.data.department || undefined,
      location: parsed.data.location || undefined,
      linkedinUrl: parsed.data.linkedinUrl || undefined,
      relationshipStage: parsed.data.relationshipStage || undefined,
      ownerId: parsed.data.ownerId || undefined,
      tags: parsed.data.tags,
      isActive: parsed.data.isActive,
    },
  });

  if (parsed.data.relationshipStage && parsed.data.relationshipStage !== before.relationshipStage) {
    const label = RELATIONSHIP_STAGE_LABELS[parsed.data.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? parsed.data.relationshipStage;
    await logContactHistory(db, id, session.userId, `Relationship stage changed to "${label}"`);
  }
  if (parsed.data.ownerId && parsed.data.ownerId !== before.ownerId) {
    const owner = await db.user.findUnique({ where: { id: parsed.data.ownerId }, select: { name: true } });
    await logContactHistory(db, id, session.userId, `Owner changed to ${owner?.name ?? "Unknown"}`);
  }
  if (typeof parsed.data.isActive === "boolean" && parsed.data.isActive !== before.isActive) {
    await logContactHistory(db, id, session.userId, parsed.data.isActive ? "Marked active" : "Marked inactive");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  await db.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
