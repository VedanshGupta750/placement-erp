import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { importApplicationRowSchema } from "@/lib/validators/import";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { Prisma } from "@/lib/generated/prisma/client";

// Row-by-row bulk "Add to Drive" — same TPO-side override rationale as
// POST /api/students/[id]/applications (deliberately skips the eligibility
// engine; a TPO importing a shortlisted set from an external sheet is an
// explicit decision, not a fresh eligibility check). One bad row doesn't
// fail the batch.
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
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "No rows to import." }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: "validation_error", message: "Import is limited to 1000 rows at a time." }, { status: 400 });
  }

  let successRows = 0;
  const errors: { rowNumber: number; field?: string; errorCode: string; message: string }[] = [];
  const touchedDriveIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const parsed = importApplicationRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ rowNumber, field: String(first.path[0] ?? ""), errorCode: "VALIDATION", message: first.message });
      continue;
    }
    const data = parsed.data;

    const student = await db.student.findFirst({ where: { enrollmentNumber: data.enrollmentNumber } });
    if (!student) {
      errors.push({ rowNumber, field: "enrollmentNumber", errorCode: "UNKNOWN_STUDENT", message: `No student found with enrollment "${data.enrollmentNumber}".` });
      continue;
    }

    const drive = await db.drive.findFirst({
      where: { title: { contains: data.driveTitle, mode: "insensitive" }, company: { name: { contains: data.companyName, mode: "insensitive" } } },
      include: { positions: true, requiredSkills: { include: { skill: true } } },
    });
    if (!drive || drive.positions.length === 0) {
      errors.push({ rowNumber, field: "driveTitle", errorCode: "UNKNOWN_DRIVE", message: `No drive matched "${data.companyName} — ${data.driveTitle}".` });
      continue;
    }
    const position = drive.positions[0];

    try {
      const studentSkills = await db.studentSkill.findMany({ where: { studentId: student.id }, include: { skill: true } });
      const { matchScore, matchedSkills, missingSkills } = computeMatchScore(
        studentSkills.map((s) => s.skill.name),
        drive.requiredSkills.map((s) => s.skill.name),
      );
      await db.application.create({
        data: {
          collegeId: session.collegeId,
          studentId: student.id,
          driveId: drive.id,
          positionId: position.id,
          status: "APPLIED",
          matchScore,
          matchedSkills,
          missingSkills,
          statusHistory: { create: { collegeId: session.collegeId, toStatus: "APPLIED", changedById: session.userId } },
        },
      });
      touchedDriveIds.add(drive.id);
      successRows += 1;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        errors.push({ rowNumber, errorCode: "DUPLICATE", message: "This student has already applied to this position." });
      } else {
        errors.push({ rowNumber, errorCode: "UNKNOWN", message: "Couldn't create this application." });
      }
    }
  }

  for (const driveId of touchedDriveIds) {
    await recomputeDriveCounters(db, driveId);
  }

  return NextResponse.json({ ok: true, successRows, errorRows: errors.length, errors: errors.slice(0, 50) });
}
