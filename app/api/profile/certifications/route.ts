import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createCertificationSchema } from "@/lib/validators/profile";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId } });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }

  try {
    await requirePermission(session, "student.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createCertificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { name, issuer, issueDate, credentialUrl } = parsed.data;

  const certification = await db.studentCertification.create({
    data: {
      studentId: student.id,
      name,
      issuer: issuer || undefined,
      issueDate: issueDate ? new Date(issueDate) : undefined,
      credentialUrl: credentialUrl || undefined,
    },
  });

  return NextResponse.json({ ok: true, id: certification.id });
}
