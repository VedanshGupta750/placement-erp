import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drive = await db.drive.findUnique({ where: { id: driveId } });
  if (!drive) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.body === "string" ? body.body.trim() : "";
  if (!bodyText) {
    return NextResponse.json({ error: "validation_error", message: "Note can't be empty." }, { status: 400 });
  }

  const note = await db.driveNote.create({
    data: { driveId, authorId: session.userId, body: bodyText },
  });

  return NextResponse.json({ ok: true, id: note.id });
}
