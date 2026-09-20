import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createBudgetItemSchema } from "@/lib/validators/budget";
import { recordAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "finance.manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createBudgetItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const maxOrder = await db.budget.aggregate({
    where: { fiscalYear: parsed.data.fiscalYear, category: parsed.data.category },
    _max: { order: true },
  });

  const item = await db.budget.create({
    data: {
      collegeId: session.collegeId,
      fiscalYear: parsed.data.fiscalYear,
      category: parsed.data.category,
      item: parsed.data.item,
      allottedAmount: parsed.data.allottedAmount ?? null,
      utilizedAmount: parsed.data.utilizedAmount ?? null,
      requestedAmount: parsed.data.requestedAmount ?? null,
      order: (maxOrder._max.order ?? 0) + 1,
      createdById: session.userId,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "finance.budget_item_added",
    resourceType: "Budget",
    resourceId: item.id,
    after: { fiscalYear: item.fiscalYear, category: item.category, item: item.item },
  });

  return NextResponse.json({ ok: true, id: item.id });
}
