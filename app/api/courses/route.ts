import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createCourseSchema } from "@/lib/validators/people";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const course = await db.course.create({ data: { collegeId: session.collegeId, ...parsed.data } });

  const department = await db.department.findFirst();
  if (department) {
    await db.departmentCourse.create({ data: { departmentId: department.id, courseId: course.id } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: course.id });
}
