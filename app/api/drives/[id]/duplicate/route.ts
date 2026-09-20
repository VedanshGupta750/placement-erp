import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Clones a drive's configuration (positions, eligible courses, required
// skills) into a new DRAFT — deliberately does NOT copy applications,
// offers, rounds, or the published eligibility rule/snapshot, since those
// belong to this specific run of the drive, not the template it represents.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: sourceId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const source = await db.drive.findUnique({
    where: { id: sourceId },
    include: { positions: true, eligibleCourses: true, requiredSkills: true },
  });
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const duplicate = await db.drive.create({
    data: {
      collegeId: session.collegeId,
      batchId: source.batchId,
      departmentId: source.departmentId,
      companyId: source.companyId,
      createdById: session.userId,
      title: `${source.title} (Copy)`,
      status: "DRAFT",
      sourceType: source.sourceType,
      locationCategory: source.locationCategory,
      driveTypeLabel: source.driveTypeLabel,
      expectedOpenings: source.expectedOpenings,
      eligibilityCriteria: source.eligibilityCriteria,
      selectionProcessDetails: source.selectionProcessDetails,
      otherDetails: source.otherDetails,
      contactPersons: source.contactPersons,
      registrationOpensAt: new Date(),
      eligibleCourses: { create: source.eligibleCourses.map((c) => ({ courseId: c.courseId })) },
      requiredSkills: { create: source.requiredSkills.map((s) => ({ skillId: s.skillId })) },
      positions: {
        create: source.positions.map((p) => ({
          collegeId: session.collegeId,
          title: p.title,
          positionType: p.positionType,
          employmentType: p.employmentType,
          minCtc: p.minCtc,
          maxCtc: p.maxCtc,
          fixedCompensation: p.fixedCompensation,
          variableCompensation: p.variableCompensation,
          stipend: p.stipend,
          joiningBonus: p.joiningBonus,
          openings: p.openings,
        })),
      },
      historyEntries: { create: { actorId: session.userId, action: "CREATED_VIA_DUPLICATE" } },
    },
  });

  return NextResponse.json({ ok: true, id: duplicate.id });
}
