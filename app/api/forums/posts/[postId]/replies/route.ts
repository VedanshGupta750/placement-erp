import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { createReplySchema } from "@/lib/validators/forum";

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const session = await requireSession();
  const { postId } = await params;
  const db = getTenantDb(session.collegeId);

  // ForumPost has no direct collegeId column and isn't in the tenant-scoping
  // extension's model list, so the isolation check has to be explicit here
  // rather than relying on getTenantDb's auto-injection.
  const post = await db.forumPost.findFirst({ where: { id: postId, forum: { collegeId: session.collegeId } } });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const reply = await db.forumReply.create({ data: { forumPostId: postId, authorId: session.userId, body: parsed.data.body } });
  return NextResponse.json({ ok: true, id: reply.id });
}
