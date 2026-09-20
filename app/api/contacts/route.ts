import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createContactSchema } from "@/lib/validators/contact";
import { logContactHistory } from "@/lib/contacts/history";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const contact = await db.contact.create({
    data: {
      collegeId: session.collegeId,
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      contactType: parsed.data.contactType || undefined,
      companyId: parsed.data.companyId || undefined,
      designation: parsed.data.designation || undefined,
      department: parsed.data.department || undefined,
      location: parsed.data.location || undefined,
      linkedinUrl: parsed.data.linkedinUrl || undefined,
      relationshipStage: parsed.data.relationshipStage || "NEW",
      ownerId: parsed.data.ownerId || undefined,
      tags: parsed.data.tags ?? undefined,
      addedById: session.userId,
    },
  });
  await logContactHistory(db, contact.id, session.userId, "Contact created");
  return NextResponse.json({ ok: true, id: contact.id });
}
