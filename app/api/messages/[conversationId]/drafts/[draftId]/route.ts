import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Deletes one of the caller's own drafts. Drafts are private to their
// author, so this deliberately scopes on authorId as well as id.
export async function DELETE(_request: Request, { params }: { params: Promise<{ conversationId: string; draftId: string }> }) {
  const { conversationId, draftId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.send");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const draft = await db.messageDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.conversationId !== conversationId || draft.authorId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.messageDraft.delete({ where: { id: draftId } });
  return NextResponse.json({ ok: true });
}
