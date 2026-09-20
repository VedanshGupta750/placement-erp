import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { createForumPostSchema } from "@/lib/validators/forum";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: forumId } = await params;
  const db = getTenantDb(session.collegeId);

  const forum = await db.forum.findUnique({ where: { id: forumId } });
  if (!forum) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createForumPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const post = await db.forumPost.create({ data: { forumId, authorId: session.userId, title: parsed.data.title, body: parsed.data.body } });
  return NextResponse.json({ ok: true, id: post.id });
}
