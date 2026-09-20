import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createProjectSchema } from "@/lib/validators/profile";

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
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { title, description, techStack, url } = parsed.data;

  const project = await db.studentProject.create({
    data: {
      studentId: student.id,
      title,
      description: description || undefined,
      techStack: techStack ?? [],
      url: url || undefined,
    },
  });

  return NextResponse.json({ ok: true, id: project.id });
}
