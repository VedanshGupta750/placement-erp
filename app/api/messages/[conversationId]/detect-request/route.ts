import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { detectRecruitmentRequest, buildCandidateSearch } from "@/lib/messages/request-detection";

// Reads the latest inbound message in a conversation and, if it's a concrete
// recruitment ask, returns a structured breakdown plus a link into the real
// student list with the criteria applied. On-demand (button-triggered), not
// run automatically on every message — same pattern as the Contact 360 AI
// insight card.
export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!conversation.participants.some((p: { userId: string }) => p.userId === session.userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // The most recent message from someone else — that's the one that would
  // contain an ask directed at this user.
  const latest = await db.message.findFirst({
    where: { conversationId, senderId: { not: session.userId }, systemGenerated: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true },
  });

  if (!latest || !latest.body.trim()) {
    return NextResponse.json({ ok: true, detected: null, message: "No incoming message to analyse yet." });
  }

  const { data, stub } = await detectRecruitmentRequest(latest.body);
  if (!data.isRecruitmentRequest) {
    return NextResponse.json({ ok: true, detected: null, stub, message: "No recruitment request found in the latest message." });
  }

  const search = await buildCandidateSearch(db, data);

  return NextResponse.json({
    ok: true,
    stub,
    detected: {
      messageId: latest.id,
      summary: data.summary,
      courseKeywords: data.courseKeywords,
      minCgpa: data.minCgpa,
      count: data.count,
      href: search.href,
      matchedCourseName: search.matchedCourseName,
      unmatchedCourseKeywords: search.unmatchedCourseKeywords,
    },
  });
}
