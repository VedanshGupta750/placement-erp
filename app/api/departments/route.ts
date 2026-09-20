import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createDepartmentSchema } from "@/lib/validators/department";

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
  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const department = await db.department.create({
    data: {
      collegeId: session.collegeId,
      name: parsed.data.name,
      code: parsed.data.code || undefined,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
    },
  });
  return NextResponse.json({ ok: true, id: department.id });
}
