import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { createApplicationSchema } from "@/lib/validators/application";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { readEligibilityPolicy, evaluateStudentEligibility } from "@/lib/students/eligibility-policy";
import { readPlacementCapPolicy, evaluatePlacementCap } from "@/lib/placement/cap";
import { PLACED_OFFER_STATUSES } from "@/lib/students/placement";

const APPLICABLE_STATUSES = new Set(["PUBLISHED", "REGISTRATION_OPEN"]);

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({
    where: { userId: session.userId },
    include: { course: { select: { isTechnical: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }
  if (!student.hasPlacementAccess) {
    return NextResponse.json({ error: "not_eligible", message: "You are not currently eligible to apply for placements." }, { status: 403 });
  }

  // The college-wide eligibility policy is enforced here, not just rendered
  // on the roster — a threshold a TPO sets in Settings that didn't actually
  // stop anyone applying would be another settable-but-unread flag.
  // evaluateStudentEligibility also covers the plain eligibleForPlacements
  // block, which is why that check is no longer separate above.
  const college = await prisma.college.findUniqueOrThrow({
    where: { id: session.collegeId },
    select: {
      eligibilityPolicyEnabled: true,
      eligibilityMinCgpa: true,
      eligibilityMaxLiveBacklogs: true,
      eligibilityMinTenthScore: true,
      eligibilityMinTwelfthScore: true,
      eligibilityRequireAcademics: true,
      placementCapEnabled: true,
      placementCapMode: true,
      placementCapFloor: true,
      placementCapMultiplier: true,
      placementCapIncrement: true,
      placementCapCrossEnabled: true,
      placementCapCrossFloor: true,
      placementCapCrossMultiplier: true,
      placementCapCrossIncrement: true,
    },
  });
  const policy = readEligibilityPolicy(college);
  const verdict = evaluateStudentEligibility(policy, student);
  if (!verdict.eligible) {
    return NextResponse.json(
      {
        error: "not_eligible",
        // The specific reason is returned so the student knows which figure
        // is the problem rather than hitting an opaque wall.
        message: `You are not currently eligible to apply for placements. ${verdict.reasons.join(" ")}`.trim(),
      },
      { status: 403 },
    );
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

  // The placement cap. Runs AFTER the drive and position are known, because
  // the rule compares this drive's package against what the student already
  // holds. An unplaced student is never affected — see lib/placement/cap.ts
  // for the modes, all of which the TPO configures under Settings.
  if (student.placementConfirmedAt) {
    const [bestOffer, bestOffCampus] = await Promise.all([
      db.offer.findFirst({
        where: { studentId: student.id, status: { in: [...PLACED_OFFER_STATUSES] } },
        orderBy: { totalCompensation: "desc" },
        select: { totalCompensation: true, drive: { select: { isTechnical: true } } },
      }),
      db.offCampusPlacement.findFirst({
        where: { studentId: student.id, status: "VERIFIED", totalCompensation: { not: null } },
        orderBy: { totalCompensation: "desc" },
        select: { totalCompensation: true },
      }),
    ]);

    const offerCtc = bestOffer ? Number(bestOffer.totalCompensation) : null;
    const offCampusCtc = bestOffCampus ? Number(bestOffCampus.totalCompensation) : null;
    const currentCtc =
      offerCtc !== null && offCampusCtc !== null ? Math.max(offerCtc, offCampusCtc) : (offerCtc ?? offCampusCtc);

    // An off-campus record has no drive to classify, so its technical side
    // is unknown and the cross-field rule simply doesn't fire for it.
    const existingIsTechnical = bestOffer ? bestOffer.drive.isTechnical : null;

    // The position's own band is more specific than anything on the drive;
    // minCtc is the floor the company advertised.
    const driveCtc = position.minCtc !== null && position.minCtc !== undefined ? Number(position.minCtc) : null;

    const decision = evaluatePlacementCap(readPlacementCapPolicy(college), {
      placed: true,
      currentCtc,
      studentIsTechnical: student.course.isTechnical,
      existingIsTechnical,
      driveCtc,
      driveIsTechnical: drive.isTechnical,
    });

    if (!decision.allowed) {
      return NextResponse.json({ error: "placement_cap", message: decision.reason }, { status: 403 });
    }
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

  // Checked up front rather than inferred from a unique-constraint failure.
  // Relying on the error meant the message depended on how the driver
  // happened to report P2002, and a DIFFERENT unique collision (ResumeUsage)
  // was being reported as "already applied" when it was nothing of the kind.
  const duplicate = await db.application.findFirst({
    where: { driveId, positionId, studentId: student.id },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "already_applied", message: "You've already applied to this position." }, { status: 409 });
  }

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
      // Plain create again: ResumeUsage is now keyed on (resumeId,
      // applicationId), which is its real grain — one row per application,
      // so applying to a second position in the same drive with the same
      // resume records a second usage instead of colliding. The earlier
      // upsert worked around the wrong key by re-pointing the existing row,
      // which quietly erased which application the first usage belonged to.
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
    // Backstop for the race between the pre-check above and this insert.
    // Scoped to the application's own constraint: any OTHER unique collision
    // is a different fault and must not be dressed up as a duplicate
    // application — mislabelling it is exactly what hid the ResumeUsage bug.
    // Both meta.target and the message are consulted because meta.target is
    // not reliably populated by this client version.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(",") : String(e.meta?.target ?? "");
      const haystack = `${target} ${e.message}`;
      if (haystack.includes("studentId")) {
        return NextResponse.json({ error: "already_applied", message: "You've already applied to this position." }, { status: 409 });
      }
    }
    throw e;
  }
}
