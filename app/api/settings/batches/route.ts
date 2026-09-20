import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createBatchSchema } from "@/lib/validators/settings";

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
  const parsed = createBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await db.batch.findFirst({ where: { year: parsed.data.year } });
  if (existing) {
    return NextResponse.json({ error: "duplicate_year", message: "A batch for this year already exists." }, { status: 409 });
  }

  const batch = await db.batch.create({ data: { collegeId: session.collegeId, year: parsed.data.year } });
  return NextResponse.json({ ok: true, batch });
}
