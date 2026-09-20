import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Live "N students eligible" count for the Create Drive wizard's Review
// step, computed against a not-yet-created drive's course selection —
// mirrors the identical pattern already proven in
// app/api/events/eligible-count/route.ts.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const courseIds: string[] = Array.isArray(body?.courseIds) ? body.courseIds.filter((v: unknown) => typeof v === "string") : [];

  const count = await db.student.count({
    where: {
      hasPlacementAccess: true,
      ...(courseIds.length > 0 ? { courseId: { in: courseIds } } : {}),
    },
  });

  return NextResponse.json({ count });
}
