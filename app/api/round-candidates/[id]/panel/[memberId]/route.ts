import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { panelMemberScoreSchema } from "@/lib/validators/round";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await requireSession();
  const { id: roundCandidateId, memberId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.score");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const member = await db.interviewPanelMember.findUnique({ where: { id: memberId } });
  if (!member || member.roundCandidateId !== roundCandidateId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = panelMemberScoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await db.interviewPanelMember.update({ where: { id: memberId }, data: { score: parsed.data.score, feedback: parsed.data.feedback, role: parsed.data.role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await requireSession();
  const { id: roundCandidateId, memberId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "interview.schedule");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const member = await db.interviewPanelMember.findUnique({ where: { id: memberId } });
  if (!member || member.roundCandidateId !== roundCandidateId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.interviewPanelMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
