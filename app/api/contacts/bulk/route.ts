import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { bulkUpdateContactsSchema, RELATIONSHIP_STAGES, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";
import { logContactHistory } from "@/lib/contacts/history";

export async function PATCH(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkUpdateContactsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { contactIds, action, value } = parsed.data;

  // Scope to contacts that actually belong to this tenant before touching anything.
  const owned = await db.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, tags: true } });
  const ownedIds = owned.map((c: { id: string }) => c.id);
  if (ownedIds.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "assign_owner") {
    await db.contact.updateMany({ where: { id: { in: ownedIds } }, data: { ownerId: value || null } });
    const owner = value ? await db.user.findUnique({ where: { id: value }, select: { name: true } }) : null;
    await Promise.all(ownedIds.map((id: string) => logContactHistory(db, id, session.userId, `Owner changed to ${owner?.name ?? "Unassigned"} (bulk)`)));
  } else if (action === "set_stage") {
    if (!RELATIONSHIP_STAGES.includes(value as (typeof RELATIONSHIP_STAGES)[number])) {
      return NextResponse.json({ error: "validation_error", message: "Invalid relationship stage." }, { status: 400 });
    }
    await db.contact.updateMany({ where: { id: { in: ownedIds } }, data: { relationshipStage: value } });
    const label = RELATIONSHIP_STAGE_LABELS[value as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? value;
    await Promise.all(ownedIds.map((id: string) => logContactHistory(db, id, session.userId, `Relationship stage changed to "${label}" (bulk)`)));
  } else if (action === "add_tag") {
    if (!value) return NextResponse.json({ error: "validation_error", message: "Tag can't be empty." }, { status: 400 });
    await Promise.all(
      owned.map(async (c: { id: string; tags: string[] }) => {
        if (c.tags.includes(value)) return;
        await db.contact.update({ where: { id: c.id }, data: { tags: { push: value } } });
        await logContactHistory(db, c.id, session.userId, `Tag "${value}" added (bulk)`);
      }),
    );
  }

  return NextResponse.json({ ok: true, updated: ownedIds.length });
}
