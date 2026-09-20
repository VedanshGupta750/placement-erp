import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { recordAudit } from "@/lib/audit";
import { Prisma } from "@/lib/generated/prisma/client";

// The Applications list page's "+ Add Application" — a general-purpose,
// staff-side counterpart to the Student-360-scoped
// POST /api/students/[id]/applications (same TPO-side override rationale,
// skips the eligibility engine), just without a pre-selected student.
//
// Deliberately a SEPARATE route from POST /api/applications, which is the
// student's own self-service "Apply to a drive" endpoint (self-scoped to
// session.userId, no permission check beyond being a student, enforces
// registration-open/eligibility). Reusing that path for an
// arbitrary-studentId staff override would have been exactly the
// shared-permission-without-ownership-check bug already found and fixed
// twice elsewhere in this app this session.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "application.approve");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const driveId = typeof body?.driveId === "string" ? body.driveId : "";
  const positionId = typeof body?.positionId === "string" ? body.positionId : "";
  if (!studentId || !driveId || !positionId) {
    return NextResponse.json({ error: "validation_error", message: "Pick a student, drive, and position." }, { status: 400 });
  }

  const [student, drive] = await Promise.all([
    db.student.findUnique({ where: { id: studentId } }),
    db.drive.findUnique({ where: { id: driveId }, include: { positions: true, requiredSkills: { include: { skill: true } } } }),
  ]);
  if (!student) return NextResponse.json({ error: "not_found", message: "Student not found." }, { status: 404 });
  if (!drive) return NextResponse.json({ error: "not_found", message: "Drive not found." }, { status: 404 });
  const position = drive.positions.find((p) => p.id === positionId);
  if (!position) return NextResponse.json({ error: "validation_error", message: "That position isn't part of this drive." }, { status: 400 });

  const studentSkills = await db.studentSkill.findMany({ where: { studentId }, include: { skill: true } });
  const { matchScore, matchedSkills, missingSkills } = computeMatchScore(
    studentSkills.map((s) => s.skill.name),
    drive.requiredSkills.map((s) => s.skill.name),
  );

  try {
    const application = await db.application.create({
      data: {
        collegeId: session.collegeId,
        studentId,
        driveId,
        positionId,
        status: "APPLIED",
        matchScore,
        matchedSkills,
        missingSkills,
        statusHistory: { create: { collegeId: session.collegeId, toStatus: "APPLIED", changedById: session.userId } },
      },
    });

    await recomputeDriveCounters(db, driveId);
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "student.field_updated",
      resourceType: "Student",
      resourceId: studentId,
      after: { addedToDrive: drive.title },
    });

    return NextResponse.json({ ok: true, id: application.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "already_applied", message: "This student has already applied to this position." }, { status: 409 });
    }
    throw e;
  }
}
