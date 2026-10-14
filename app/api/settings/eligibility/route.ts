import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { eligibilityPolicySchema } from "@/lib/validators/settings";
import { recordAudit } from "@/lib/audit";

// The college-wide eligibility policy. Uses `prisma` rather than the tenant
// client because College is the tenant row itself — the id comes from the
// session, so it is still scoped, just not through a where-injecting proxy.
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
  const parsed = eligibilityPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const before = await prisma.college.findUniqueOrThrow({
    where: { id: session.collegeId },
    select: {
      eligibilityPolicyEnabled: true,
      eligibilityMinCgpa: true,
      eligibilityMaxLiveBacklogs: true,
      eligibilityMinTenthScore: true,
      eligibilityMinTwelfthScore: true,
      eligibilityRequireAcademics: true,
    },
  });

  await prisma.college.update({ where: { id: session.collegeId }, data: parsed.data });

  // This changes who can apply to drives college-wide, so it belongs in the
  // trail with both the old and the new shape — "placements stopped working
  // for half the batch" is otherwise very hard to trace back to a settings
  // toggle.
  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "settings.eligibility_policy_updated",
    resourceType: "College",
    resourceId: session.collegeId,
    after: { before, after: parsed.data },
  });

  return NextResponse.json({ ok: true });
}
