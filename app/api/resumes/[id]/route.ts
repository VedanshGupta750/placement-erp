import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { setDefaultResumeSchema } from "@/lib/validators/resume";
import { Prisma } from "@/lib/generated/prisma/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId } });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }

  try {
    await requirePermission(session, "resume.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = setDefaultResumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", message: "Only setting a resume as default is supported here." }, { status: 400 });
  }

  const resume = await db.resume.findUnique({ where: { id } });
  if (!resume || resume.studentId !== student.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.resume.updateMany({ where: { studentId: student.id, isDefault: true }, data: { isDefault: false } });
    await tx.resume.update({ where: { id }, data: { isDefault: true } });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId } });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }

  try {
    await requirePermission(session, "resume.delete");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const resume = await db.resume.findUnique({ where: { id } });
  if (!resume || resume.studentId !== student.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await db.resume.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2003" || e.code === "P2014")) {
      return NextResponse.json(
        { error: "in_use", message: "This resume has already been used on an application and can't be deleted." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
