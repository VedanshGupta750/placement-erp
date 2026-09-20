import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { Prisma } from "@/lib/generated/prisma/client";

// The TPO-side "Add to Drive" action — unlike POST /api/applications
// (student self-service only, looks up the CALLER's own student row), this
// creates an application on behalf of an arbitrary student. Deliberately
// does NOT run the eligibility engine — a TPO manually adding someone is an
// explicit override, same spirit as EligibilityOverride elsewhere in this
// app.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "application.approve");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const driveId = typeof body?.driveId === "string" ? body.driveId : "";
  const positionId = typeof body?.positionId === "string" ? body.positionId : "";
  if (!driveId || !positionId) {
    return NextResponse.json({ error: "validation_error", message: "Pick a drive and a position." }, { status: 400 });
  }

  const drive = await db.drive.findUnique({
    where: { id: driveId },
    include: { positions: true, requiredSkills: { include: { skill: true } } },
  });
  if (!drive) return NextResponse.json({ error: "not_found", message: "Drive not found." }, { status: 404 });
  const position = drive.positions.find((p: { id: string }) => p.id === positionId);
  if (!position) return NextResponse.json({ error: "validation_error", message: "That position isn't part of this drive." }, { status: 400 });

  const studentSkills = await db.studentSkill.findMany({ where: { studentId }, include: { skill: true } });
  const { matchScore, matchedSkills, missingSkills } = computeMatchScore(
    studentSkills.map((s: { skill: { name: string } }) => s.skill.name),
    drive.requiredSkills.map((s: { skill: { name: string } }) => s.skill.name),
  );

  try {
    const application = await db.$transaction(async (tx) => {
      const app = await tx.application.create({
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
      return app;
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

    await notifyUser(
      db,
      session.collegeId,
      student.userId,
      "application.added_by_staff",
      `Added to ${drive.title}`,
      `You've been added to "${drive.title}" (${position.title}) by placement staff.`,
      `/applications`,
    );

    return NextResponse.json({ ok: true, id: application.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "already_applied", message: "This student has already applied to this position." }, { status: 409 });
    }
    throw e;
  }
}
