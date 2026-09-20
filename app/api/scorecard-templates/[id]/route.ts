import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { scorecardTemplateSchema } from "@/lib/validators/round";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = scorecardTemplateSchema.pick({ criteria: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const template = await db.scorecardTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.scorecardTemplate.update({ where: { id }, data: { criteria: parsed.data.criteria } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const template = await db.scorecardTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.scorecardTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
