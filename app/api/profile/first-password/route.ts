import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordStrengthSchema } from "@/lib/validators/auth";

// Academics are collected here and ONLY here for a student: this endpoint
// only works while mustChangePassword is set, so it is a genuine one-time
// window. Afterwards the record is staff-maintained and a student can only
// propose changes through AcademicChangeRequest.
const schema = z.object({
  password: passwordStrengthSchema,
  tenthScore: z.coerce.number().min(0).max(100).optional(),
  twelfthScore: z.coerce.number().min(0).max(100).optional(),
  aggregate: z.coerce.number().min(0).max(10).optional(),
  semesterResults: z
    .array(z.object({ semester: z.coerce.number().int().min(1).max(12), sgpa: z.coerce.number().min(0).max(10) }))
    .max(12)
    .optional(),
});

// First-login password change. Unlike /api/profile/change-password this
// does NOT ask for the current password — the user just signed in with it,
// so re-typing a password the placement cell chose adds friction without
// adding proof. It is only usable while mustChangePassword is set.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, mustChangePassword: true },
  });

  if (!user.mustChangePassword) {
    return NextResponse.json(
      { error: "not_required", message: "Your password has already been set. Use Change password instead." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Refusing the starter password is the whole point of forcing this step.
  if (await verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json(
      { error: "same_password", message: "Choose a password different from the one you were given." },
      { status: 400 },
    );
  }

  const student = await db.student.findFirst({ where: { userId: session.userId }, select: { id: true } });
  const academics = parsed.data;

  // One transaction: a student must never end up with their academics saved
  // but the password unchanged (or the reverse), because the flag is what
  // gates this endpoint — losing it would close the window permanently.
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(academics.password),
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });

    if (!student) return;

    const scores: Record<string, number> = {};
    if (academics.tenthScore !== undefined) scores.tenthScore = academics.tenthScore;
    if (academics.twelfthScore !== undefined) scores.twelfthScore = academics.twelfthScore;
    if (academics.aggregate !== undefined) scores.aggregate = academics.aggregate;
    if (Object.keys(scores).length > 0) {
      // Deliberately NOT stamped as verified — these are self-declared.
      // Staff verify them from the Academic tab.
      await tx.student.update({ where: { id: student.id }, data: scores });
    }

    for (const row of academics.semesterResults ?? []) {
      await tx.studentSemesterResult.upsert({
        where: { studentId_semester: { studentId: student.id, semester: row.semester } },
        create: { studentId: student.id, semester: row.semester, sgpa: row.sgpa },
        update: { sgpa: row.sgpa },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
