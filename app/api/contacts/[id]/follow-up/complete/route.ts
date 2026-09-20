import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { logContactHistory } from "@/lib/contacts/history";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.contact.update({
    where: { id },
    data: { nextFollowUpAt: null, nextFollowUpNote: null },
  });

  if (contact.nextFollowUpNote) {
    await db.contactCommunication.create({
      data: {
        contactId: id,
        authorId: session.userId,
        type: "NOTE",
        subject: "Follow-up completed",
        body: `Marked the follow-up "${contact.nextFollowUpNote}" as completed.`,
      },
    });
  }

  await logContactHistory(db, id, session.userId, "Follow-up marked complete");

  return NextResponse.json({ ok: true });
}
