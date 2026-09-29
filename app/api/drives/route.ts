import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createDriveSchema } from "@/lib/validators/drive";

// Active drives + positions for pickers (e.g. bulk "Add to Drive" on the
// Students list) — gated on the same permission that action itself needs.
export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "application.approve");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drives = await db.drive.findMany({
    where: { status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] } },
    include: { company: { select: { name: true } }, positions: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    drives: drives.map((d: { id: string; title: string; company: { name: string }; positions: { id: string; title: string }[] }) => ({
      id: d.id,
      title: d.title,
      companyName: d.company.name,
      positions: d.positions,
    })),
  });
}

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
  const parsed = createDriveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const [department, batch] = await Promise.all([
    db.department.findFirstOrThrow({ select: { id: true } }),
    // Explicit batch first, then whatever cohort the user is working in
    // (the header switcher), and only then the newest year. Defaulting
    // straight to "newest" silently pointed every new drive at the most
    // recent batch — harmless with one batch, wrong the moment a second
    // exists, because eligibility resolves candidates by drive.batchId.
    data.batchId
      ? db.batch.findFirstOrThrow({ where: { id: data.batchId }, select: { id: true } })
      : (await getActiveBatchId().then((id) =>
          id
            ? db.batch.findFirst({ where: { id }, select: { id: true } })
            : null,
        )) ?? db.batch.findFirstOrThrow({ orderBy: { year: "desc" }, select: { id: true } }),
  ]);
  const company = await db.company.upsert({
    where: { name: data.companyName },
    create: { name: data.companyName },
    update: {},
  });
  await db.collegePartnership.upsert({
    where: { collegeId_companyId: { collegeId: session.collegeId, companyId: company.id } },
    create: { collegeId: session.collegeId, companyId: company.id, status: "ACTIVE", connectedAt: new Date() },
    update: {},
  });

  const drive = await db.drive.create({
    data: {
      collegeId: session.collegeId,
      batchId: batch.id,
      departmentId: department.id,
      companyId: company.id,
      createdById: session.userId,
      title: data.title,
      status: "DRAFT",
      locationCategory: data.locationCategory,
      expectedOpenings: data.expectedOpenings,
      eligibilityCriteria: data.eligibilityCriteria,
      selectionProcessDetails: data.selectionProcessDetails,
      otherDetails: data.otherDetails,
      contactPersons: data.contactPersons,
      registrationOpensAt: new Date(),
      registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : undefined,
      eligibleCourses: { create: data.courseIds.map((courseId) => ({ courseId })) },
      requiredSkills: { create: (data.skillIds ?? []).map((skillId) => ({ skillId })) },
      positions: {
        create: {
          collegeId: session.collegeId,
          title: data.title,
          positionType: data.positionType,
          employmentType: data.employmentType,
          minCtc: data.minCtc,
          maxCtc: data.maxCtc,
          stipend: data.maxStipend,
          openings: data.expectedOpenings,
        },
      },
      historyEntries: { create: { actorId: session.userId, action: "CREATED" } },
    },
  });

  return NextResponse.json({ ok: true, id: drive.id });
}
