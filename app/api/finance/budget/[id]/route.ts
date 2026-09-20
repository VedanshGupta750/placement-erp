import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { updateBudgetItemSchema } from "@/lib/validators/budget";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "finance.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateBudgetItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await db.budget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: Record<string, number | null> = {};
  if ("allottedAmount" in parsed.data) data.allottedAmount = parsed.data.allottedAmount ?? null;
  if ("utilizedAmount" in parsed.data) data.utilizedAmount = parsed.data.utilizedAmount ?? null;
  if ("requestedAmount" in parsed.data) data.requestedAmount = parsed.data.requestedAmount ?? null;

  await db.budget.update({ where: { id }, data });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "finance.budget_item_updated",
    resourceType: "Budget",
    resourceId: id,
    after: data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "finance.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const existing = await db.budget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.budget.delete({ where: { id } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "finance.budget_item_deleted",
    resourceType: "Budget",
    resourceId: id,
    after: { fiscalYear: existing.fiscalYear, category: existing.category, item: existing.item },
  });

  return NextResponse.json({ ok: true });
}
