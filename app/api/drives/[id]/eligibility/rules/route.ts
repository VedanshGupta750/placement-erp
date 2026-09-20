import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createEligibilityRuleSchema } from "@/lib/validators/eligibility";
import { buildSimpleEligibilityLogic } from "@/lib/eligibility";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  const rules = await db.driveEligibilityRule.findMany({ where: { driveId }, orderBy: { version: "desc" } });
  return NextResponse.json({ rules });
}

// Creates a new (unpublished) rule version — call .../eligibility/publish to
// evaluate it against the batch and freeze a snapshot.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "eligibility.create_rule");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createEligibilityRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const lastVersion = await db.driveEligibilityRule.findFirst({ where: { driveId }, orderBy: { version: "desc" }, select: { version: true } });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const rule = await db.driveEligibilityRule.create({
    data: {
      collegeId: session.collegeId,
      driveId,
      version: nextVersion,
      isPublished: false,
      logic: buildSimpleEligibilityLogic(parsed.data),
      createdById: session.userId,
    },
  });

  return NextResponse.json({ ok: true, id: rule.id, version: rule.version });
}
