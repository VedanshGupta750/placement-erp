import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { offCampusPlacementSchema } from "@/lib/validators/off-campus";
import { recordAudit } from "@/lib/audit";

// Records a placement the student found themselves, outside the college's
// drives. Gated on offer.create rather than student.edit: this is a
// placement record and it moves the placement rate, so it belongs with the
// roles that manage offers, not with everyone who can correct a CGPA.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "offer.create");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const scopeWhere = await getStudentScopeWhere(db, session);
  const student = await db.student.findFirst({ where: { id: studentId, ...scopeWhere }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = offCampusPlacementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const placement = await db.offCampusPlacement.create({
    data: {
      collegeId: session.collegeId,
      studentId,
      companyName: data.companyName,
      role: data.role,
      placementType: data.placementType,
      // Staff-entered records are verified by definition: the person
      // recording it is the person who would otherwise verify it. The
      // REPORTED state exists for a future student self-report path.
      status: "VERIFIED",
      totalCompensation: data.totalCompensation,
      stipend: data.stipend,
      durationMonths: data.durationMonths,
      location: data.location,
      offerDate: data.offerDate ? new Date(data.offerDate) : undefined,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      source: data.source,
      notes: data.notes,
      recordedById: session.userId,
      verifiedById: session.userId,
      verifiedAt: new Date(),
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.off_campus_recorded",
    resourceType: "Student",
    resourceId: studentId,
    after: {
      placementId: placement.id,
      companyName: data.companyName,
      placementType: data.placementType,
      totalCompensation: data.totalCompensation ?? null,
      stipend: data.stipend ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: placement.id });
}
