import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { notifyUsers } from "@/lib/notify";
import {
  createAcademicRequestSchema,
  ACADEMIC_FIELD_COLUMN,
  ACADEMIC_FIELD_LABELS,
  type AcademicRequestField,
} from "@/lib/validators/academic-request";

// A student raising a correction against their OWN academic record.
// Deliberately under /api/profile rather than /api/students/[id]: the
// student is always the subject, so there is no id to tamper with — the
// session decides whose record this is about.
export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findFirst({ where: { userId: session.userId }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "not_a_student" }, { status: 403 });

  const requests = await db.academicChangeRequest.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    include: { reviewedBy: { select: { name: true } } },
  });
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findFirst({
    where: { userId: session.userId },
    select: { id: true, aggregate: true, liveBacklogs: true, closedBacklogs: true, enrollmentNumber: true, user: { select: { name: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "not_a_student", message: "Only students can raise academic change requests." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createAcademicRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const field = parsed.data.field as AcademicRequestField;
  const currentValue = student[ACADEMIC_FIELD_COLUMN[field]] ?? null;

  if (currentValue !== null && currentValue === parsed.data.requestedValue) {
    return NextResponse.json(
      { error: "no_change", message: `Your ${ACADEMIC_FIELD_LABELS[field]} is already ${currentValue}.` },
      { status: 400 },
    );
  }

  // One open request per field: otherwise a student can queue five
  // contradictory CGPAs and whichever the TPO happens to click decides it.
  const existing = await db.academicChangeRequest.findFirst({
    where: { studentId: student.id, field, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "already_pending", message: `You already have a pending request for ${ACADEMIC_FIELD_LABELS[field]}. Wait for it to be reviewed.` },
      { status: 409 },
    );
  }

  const created = await db.academicChangeRequest.create({
    data: {
      collegeId: session.collegeId,
      studentId: student.id,
      field,
      currentValue,
      requestedValue: parsed.data.requestedValue,
      reason: parsed.data.reason,
    },
    select: { id: true },
  });

  // The review UI lives on the student's own profile page rather than in a
  // queue of its own, so staff are told a request exists — otherwise it
  // waits until someone happens to open that student.
  const staff = await db.user.findMany({
    where: { userType: "PLACEMENT_TEAM", status: "ACTIVE" },
    select: { id: true },
  });
  await notifyUsers(
    db,
    session.collegeId,
    staff.map((s) => s.id),
    "academic.change_requested",
    "Academic change request",
    `${student.user.name} (${student.enrollmentNumber}) requested ${ACADEMIC_FIELD_LABELS[field]}: ${currentValue ?? "—"} → ${parsed.data.requestedValue}`,
    `/students/${student.id}?tab=academic`,
  );

  return NextResponse.json({ ok: true, id: created.id });
}
