import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { addDepartmentMemberSchema } from "@/lib/validators/department";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: departmentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const department = await db.department.findUnique({ where: { id: departmentId } });
  if (!department) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = addDepartmentMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const membership = await db.departmentMembership.upsert({
    where: { departmentId_userId: { departmentId, userId: parsed.data.userId } },
    create: {
      departmentId,
      userId: parsed.data.userId,
      designation: parsed.data.designation,
      title: parsed.data.title,
      isAdmin: parsed.data.isAdmin,
    },
    update: {
      designation: parsed.data.designation,
      title: parsed.data.title,
      isAdmin: parsed.data.isAdmin,
    },
  });
  return NextResponse.json({ ok: true, id: membership.id });
}
