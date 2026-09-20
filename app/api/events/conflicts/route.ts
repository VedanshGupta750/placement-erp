import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { findScheduleConflicts } from "@/lib/events/conflict-detection";

// Non-blocking schedule-conflict check surfaced as a warning banner in the
// Create/Edit wizard's Schedule step — a TPO can still publish through a
// conflict, this is purely advisory.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  if (!body?.startAt || !body?.endAt) {
    return NextResponse.json({ conflicts: [] });
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ conflicts: [] });
  }

  const conflicts = await findScheduleConflicts(db, {
    startAt,
    endAt,
    venue: typeof body.venue === "string" ? body.venue : null,
    speakerId: typeof body.speakerId === "string" ? body.speakerId : null,
    excludeEventId: typeof body.excludeEventId === "string" ? body.excludeEventId : undefined,
  });

  return NextResponse.json({ conflicts });
}
