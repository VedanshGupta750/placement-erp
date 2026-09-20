import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { resolveAudienceUserIds, type AudienceInput } from "@/lib/broadcasts";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "broadcast.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const audience = (await request.json().catch(() => null)) as AudienceInput | null;
  if (!audience?.audienceType) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const userIds = await resolveAudienceUserIds(db, session.collegeId, audience);
  return NextResponse.json({ count: userIds.length });
}
