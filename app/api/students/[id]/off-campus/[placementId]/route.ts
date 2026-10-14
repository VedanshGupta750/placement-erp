import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { offCampusPlacementSchema, offCampusStatusSchema } from "@/lib/validators/off-campus";
import { recordAudit } from "@/lib/audit";

type Session = { collegeId: string; userId: string; roleId: string | null };

// Row-level scope applies here as it does to every other student mutation:
// a Department Coordinator must not reach a record outside their departments
// by calling the endpoint directly with an id.
async function loadScoped(session: Session, studentId: string, placementId: string) {
  const db = getTenantDb(session.collegeId);
  const scopeWhere = await getStudentScopeWhere(db, session);
  const student = await db.student.findFirst({ where: { id: studentId, ...scopeWhere }, select: { id: true } });
  if (!student) return { db, placement: null };
  const placement = await db.offCampusPlacement.findFirst({ where: { id: placementId, studentId } });
  return { db, placement };
}

// Two shapes of change, deliberately separate. `status` verifies or rejects
// a record; everything else edits its figures. "I have seen the offer
// letter" is a different decision from "the stipend was wrong", and only the
// first should move the placement rate.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; placementId: string }> }) {
  const session = await requireSession();
  const { id: studentId, placementId } = await params;

  const { db, placement } = await loadScoped(session, studentId, placementId);
  try {
    await requirePermission(session, "offer.edit");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
  if (!placement) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  // Joining is its own milestone, separate from verification and from the
  // figures — "they actually started" is a different fact from "I have seen
  // the offer letter".
  if (body && typeof body === "object" && "joined" in body) {
    const joined = body.joined === true;
    await db.offCampusPlacement.update({
      where: { id: placementId },
      data: { joinedAt: joined ? new Date() : null },
    });
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "student.off_campus_status_changed",
      resourceType: "Student",
      resourceId: studentId,
      after: { placementId, joined, companyName: placement.companyName },
    });
    return NextResponse.json({ ok: true, joined });
  }

  if (body && typeof body === "object" && "status" in body) {
    const parsed = offCampusStatusSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "validation_error" }, { status: 400 });
    const verified = parsed.data.status === "VERIFIED";
    await db.offCampusPlacement.update({
      where: { id: placementId },
      data: {
        status: parsed.data.status,
        verifiedById: verified ? session.userId : null,
        verifiedAt: verified ? new Date() : null,
      },
    });
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "student.off_campus_status_changed",
      resourceType: "Student",
      resourceId: studentId,
      after: { placementId, from: placement.status, to: parsed.data.status, companyName: placement.companyName },
    });
    return NextResponse.json({ ok: true });
  }

  const parsed = offCampusPlacementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  // Explicit nulls, not undefined: this is a full-record edit from a form
  // where every box is shown, so clearing a stipend must actually clear it.
  // (The offer edit dialog takes the opposite approach for the opposite
  // reason — see components/offers/edit-offer-dialog.tsx.)
  await db.offCampusPlacement.update({
    where: { id: placementId },
    data: {
      companyName: data.companyName,
      role: data.role ?? null,
      placementType: data.placementType,
      totalCompensation: data.totalCompensation ?? null,
      stipend: data.stipend ?? null,
      durationMonths: data.durationMonths ?? null,
      location: data.location ?? null,
      offerDate: data.offerDate ? new Date(data.offerDate) : null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
      source: data.source ?? null,
      notes: data.notes ?? null,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.off_campus_edited",
    resourceType: "Student",
    resourceId: studentId,
    after: {
      placementId,
      before: {
        companyName: placement.companyName,
        placementType: placement.placementType,
        totalCompensation: placement.totalCompensation?.toString() ?? null,
        stipend: placement.stipend?.toString() ?? null,
      },
      changes: data,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; placementId: string }> }) {
  const session = await requireSession();
  const { id: studentId, placementId } = await params;

  const { db, placement } = await loadScoped(session, studentId, placementId);
  try {
    await requirePermission(session, "offer.edit");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
  if (!placement) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.offCampusPlacement.delete({ where: { id: placementId } });
  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.off_campus_deleted",
    resourceType: "Student",
    resourceId: studentId,
    after: { placementId, companyName: placement.companyName, placementType: placement.placementType },
  });
  return NextResponse.json({ ok: true });
}
