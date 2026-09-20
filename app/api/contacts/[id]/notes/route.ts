import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createContactNoteSchema } from "@/lib/validators/contact";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: contactId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createContactNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", message: parsed.error.issues[0]?.message ?? "Note can't be empty." }, { status: 400 });
  }

  const note = await db.contactNote.create({
    data: { contactId, authorId: session.userId, body: parsed.data.body },
  });

  return NextResponse.json({ ok: true, id: note.id });
}
