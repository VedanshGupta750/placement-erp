import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { notifyUser } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import {
  reviewAcademicRequestSchema,
  ACADEMIC_FIELD_COLUMN,
  ACADEMIC_FIELD_LABELS,
  type AcademicRequestField,
} from "@/lib/validators/academic-request";

// Approve or reject a student's academic change request. Approval is the
// ONLY path by which a student-supplied number reaches the Student row —
// raising a request never touches it.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const session = await requireSession();
  const { id: studentId, requestId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    // Same bar as editing academics by hand, because that is exactly what
    // an approval does.
    await requirePermission(session, "student.edit");
    await requirePermission(session, "student.view_sensitive");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewAcademicRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Scoped by studentId as well as id so a request id from another student
  // can't be actioned through this route.
  const req = await db.academicChangeRequest.findFirst({
    where: { id: requestId, studentId },
    include: { student: { select: { id: true, userId: true, enrollmentNumber: true } } },
  });
  if (!req) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (req.status !== "PENDING") {
    return NextResponse.json(
      { error: "already_reviewed", message: `This request was already ${req.status.toLowerCase()}.` },
      { status: 409 },
    );
  }

  const field = req.field as AcademicRequestField;
  const column = ACADEMIC_FIELD_COLUMN[field];
  const approved = parsed.data.action === "APPROVE";

  const reviewer = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true } });

  await db.$transaction(async (tx) => {
    await tx.academicChangeRequest.update({
      where: { id: req.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNote: parsed.data.reviewNote || null,
      },
    });

    if (approved) {
      await tx.student.update({
        where: { id: studentId },
        data: {
          [column]: req.requestedValue,
          // An approved value has been looked at by a human, so it counts
          // as verified — this is the first thing in the app to write the
          // long-dormant academicsVerifiedAt column.
          academicsVerifiedAt: new Date(),
        },
      });
    }
  });

  await notifyUser(
    db,
    session.collegeId,
    req.student.userId,
    approved ? "academic.change_approved" : "academic.change_rejected",
    approved ? "Academic change approved" : "Academic change rejected",
    approved
      ? `${reviewer.name} approved your ${ACADEMIC_FIELD_LABELS[field]} change to ${req.requestedValue}.`
      : `${reviewer.name} rejected your ${ACADEMIC_FIELD_LABELS[field]} request${parsed.data.reviewNote ? `: ${parsed.data.reviewNote}` : "."}`,
    "/profile",
  );

  // Academic records drive eligibility, so a change of them is audited the
  // same way a manual staff edit would be.
  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: approved ? "student.academic_change_approved" : "student.academic_change_rejected",
    resourceType: "Student",
    resourceId: studentId,
    after: { field, from: req.currentValue, to: approved ? req.requestedValue : req.currentValue },
    reason: parsed.data.reviewNote || undefined,
  });

  return NextResponse.json({ ok: true, status: approved ? "APPROVED" : "REJECTED", reviewedBy: reviewer.name });
}
