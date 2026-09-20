import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

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

  const expense = await db.placementExpense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.placementExpense.delete({ where: { id } });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "finance.expense_deleted",
    resourceType: "PlacementExpense",
    resourceId: id,
    after: { category: expense.category, amount: Number(expense.amount) },
  });

  return NextResponse.json({ ok: true });
}
