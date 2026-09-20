import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { createForumSchema } from "@/lib/validators/forum";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const parsed = createForumSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const forum = await db.forum.create({ data: { collegeId: session.collegeId, title: parsed.data.title, description: parsed.data.description, createdById: session.userId } });
  return NextResponse.json({ ok: true, id: forum.id });
}
