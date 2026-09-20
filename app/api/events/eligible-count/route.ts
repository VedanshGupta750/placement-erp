import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Live "N students eligible" count for the Audience & Eligibility wizard
// step, computed against a not-yet-created event's raw params. Mirrors the
// population query in lib/events/eligibility-runner.ts's
// getEventCandidatePopulation (hasPlacementAccess + batch/department scope)
// so "eligible count" means the same thing here and on the event detail
// page once the event actually exists.
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
  const eligibleBatchIds: string[] = Array.isArray(body?.eligibleBatchIds)
    ? body.eligibleBatchIds.filter((v: unknown) => typeof v === "string")
    : [];
  const eligibleDepartmentIds: string[] = Array.isArray(body?.eligibleDepartmentIds)
    ? body.eligibleDepartmentIds.filter((v: unknown) => typeof v === "string")
    : [];

  const count = await db.student.count({
    where: {
      hasPlacementAccess: true,
      ...(eligibleBatchIds.length > 0 ? { batchId: { in: eligibleBatchIds } } : {}),
      ...(eligibleDepartmentIds.length > 0 ? { departmentId: { in: eligibleDepartmentIds } } : {}),
    },
  });

  return NextResponse.json({ count });
}
