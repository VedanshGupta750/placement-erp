import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Revokes a manual override. Deleting the row (rather than flipping a flag)
// is what getActiveOverrides already expects — the student falls straight
// back to whatever the published rule tree decides for them.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; overrideId: string }> }) {
  const session = await requireSession();
  const { id: driveId, overrideId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "eligibility.override");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // Scoped by driveId as well as id so an override id from another drive
  // (or, via the tenant db, another college) can't be deleted through here.
  const existing = await db.eligibilityOverride.findFirst({ where: { id: overrideId, driveId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.eligibilityOverride.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
