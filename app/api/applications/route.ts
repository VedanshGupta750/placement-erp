import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { createApplicationSchema } from "@/lib/validators/application";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { Prisma } from "@/lib/generated/prisma/client";

const APPLICABLE_STATUSES = new Set(["PUBLISHED", "REGISTRATION_OPEN"]);

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId } });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }
  if (!student.eligibleForPlacements || !student.hasPlacementAccess) {
    return NextResponse.json({ error: "not_eligible", message: "You are not currently eligible to apply for placements." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { driveId, positionId, resumeId, fieldValues } = parsed.data;

  const drive = await db.drive.findUnique({
    where: { id: driveId },
    include: { positions: true, requiredSkills: { include: { skill: true } }, applicationFields: true },
  });
  if (!drive) {
    return NextResponse.json({ error: "not_found", message: "Drive not found." }, { status: 404 });
  }
  const position = drive.positions.find((p) => p.id === positionId);
  if (!position) {
    return NextResponse.json({ error: "invalid_position", message: "That position isn't part of this drive." }, { status: 400 });
  }
  if (!APPLICABLE_STATUSES.has(drive.status)) {
    return NextResponse.json({ error: "registration_closed", message: "Registrations for this drive are not open." }, { status: 409 });
  }
  if (drive.registrationClosesAt && new Date() > drive.registrationClosesAt) {
    return NextResponse.json({ error: "registration_closed", message: "Registration for this drive has closed." }, { status: 409 });
  }

  // The resume is mandatory and must be a real, downloadable file. Three
  // separate things are checked because they fail differently:
  //   - not found / not theirs -> someone editing the request by hand
  //   - no file attached       -> a Resume row can exist with fileId NULL
  //     (the older seed/expand scripts created some), and those are
  //     invisible to the recruiter and skipped by the drive resume ZIP
  const resume = await db.resume.findUnique({ where: { id: resumeId }, select: { studentId: true, fileId: true } });
  if (!resume || resume.studentId !== student.id) {
    return NextResponse.json({ error: "invalid_resume", message: "Select a valid resume." }, { status: 400 });
  }
  if (!resume.fileId) {
    return NextResponse.json(
      {
        error: "resume_has_no_file",
        message: "That resume has no file attached. Upload it again from the Resumes page before applying.",
      },
      { status: 400 },
    );
  }

  const validFieldIds = new Set(drive.applicationFields.map((f) => f.id));
  const submittedFieldIds = new Set(fieldValues.filter((v) => v.value.trim()).map((v) => v.fieldId));
  const missingRequired = drive.applicationFields.find((f) => f.required && !submittedFieldIds.has(f.id));
  if (missingRequired) {
    return NextResponse.json({ error: "validation_error", message: `${missingRequired.label} is required.` }, { status: 400 });
  }
  const validFieldValues = fieldValues.filter((v) => v.value.trim() && validFieldIds.has(v.fieldId));

  const studentSkills = await db.studentSkill.findMany({ where: { studentId: student.id }, include: { skill: true } });
  const studentSkillNames = studentSkills.map((s) => s.skill.name);
  const requiredSkillNames = drive.requiredSkills.map((s) => s.skill.name);
  const { matchScore, matchedSkills, missingSkills } = computeMatchScore(studentSkillNames, requiredSkillNames);

  try {
    const application = await db.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          collegeId: session.collegeId,
          studentId: student.id,
          driveId,
          positionId,
          resumeId,
          status: "APPLIED",
          matchScore,
          matchedSkills,
          missingSkills,
          statusHistory: {
            create: { collegeId: session.collegeId, toStatus: "APPLIED", changedById: session.userId },
          },
        },
      });
      await tx.resumeUsage.create({ data: { resumeId, driveId, applicationId: app.id } });
      if (validFieldValues.length > 0) {
        await tx.applicationFieldValue.createMany({
          data: validFieldValues.map((v) => ({ applicationId: app.id, fieldId: v.fieldId, value: v.value })),
        });
      }
      return app;
    });

    await recomputeDriveCounters(db, driveId);

    return NextResponse.json({ ok: true, id: application.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "already_applied", message: "You've already applied to this position." }, { status: 409 });
    }
    throw e;
  }
}
