import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { panelMemberSchema } from "@/lib/validators/round";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: roundCandidateId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "interview.schedule");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const candidate = await db.roundCandidate.findUnique({ where: { id: roundCandidateId } });
  if (!candidate) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = panelMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const member = await db.interviewPanelMember.create({
    data: { collegeId: session.collegeId, roundCandidateId, name: parsed.data.name, role: parsed.data.role ?? "Panel Member" },
  });
  return NextResponse.json({ ok: true, id: member.id });
}
