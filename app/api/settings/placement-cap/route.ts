import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

const money = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || (typeof v === "string" && v.trim() === "") ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Must be a positive amount.");

const factor = z
  .union([z.number(), z.null()])
  .refine((v) => v === null || (Number.isFinite(v) && v >= 1 && v <= 20), "Must be between 1 and 20.");

const schema = z.object({
  placementCapEnabled: z.boolean(),
  placementCapMode: z.enum(["INCREMENT", "FIXED_FLOOR", "MULTIPLIER"]),
  placementCapFloor: money,
  placementCapMultiplier: factor,
  placementCapIncrement: money,
  placementCapCrossEnabled: z.boolean(),
  placementCapCrossFloor: money,
  placementCapCrossMultiplier: factor,
  placementCapCrossIncrement: money,
  /** Courses the TPO has ticked as technical; everything else is not. */
  technicalCourseIds: z.array(z.string()),
});

export async function PATCH(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { technicalCourseIds, ...cap } = parsed.data;

  await prisma.college.update({ where: { id: session.collegeId }, data: cap });

  // Set both sides explicitly rather than only the ticked ones — otherwise
  // unticking a course would never actually clear its flag.
  await db.course.updateMany({ where: { id: { in: technicalCourseIds } }, data: { isTechnical: true } });
  await db.course.updateMany({ where: { id: { notIn: technicalCourseIds } }, data: { isTechnical: false } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "settings.placement_cap_updated",
    resourceType: "College",
    resourceId: session.collegeId,
    // This decides who may apply to what college-wide, so the trail keeps
    // the whole shape rather than just "it changed".
    after: { ...cap, technicalCourseCount: technicalCourseIds.length },
  });

  return NextResponse.json({ ok: true });
}
