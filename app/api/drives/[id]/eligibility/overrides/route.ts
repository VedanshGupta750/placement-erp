import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { overrideSchema } from "@/lib/validators/eligibility";
import { getCandidatePopulation } from "@/lib/eligibility-runner";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "eligibility.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const overrides = await db.eligibilityOverride.findMany({
    where: { driveId },
    include: { student: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ overrides });
}

// Manually flips a specific student's eligibility for this drive — reason
// is mandatory and every override is audited (createdById, timestamp).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "eligibility.override");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // The evaluator only ever walks the drive's candidate population (right
  // batch, an eligible course, placement access). An override on a student
  // outside it would be stored and then silently ignored at preview and
  // publish, so refuse it here with a reason the TPO can act on instead.
  const { students } = await getCandidatePopulation(db, driveId);
  if (!students.some((s) => s.id === parsed.data.studentId)) {
    return NextResponse.json(
      {
        error: "not_in_population",
        message:
          "This student isn't in the drive's candidate pool (batch, eligible course and placement access). Add their course to the drive instead of overriding.",
      },
      { status: 400 },
    );
  }

  const override = await db.eligibilityOverride.create({
    data: {
      collegeId: session.collegeId,
      driveId,
      studentId: parsed.data.studentId,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
      createdById: session.userId,
    },
  });

  return NextResponse.json({ ok: true, id: override.id });
}
