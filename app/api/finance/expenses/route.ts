import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createExpenseSchema } from "@/lib/validators/finance";
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
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.driveId) {
    const drive = await db.drive.findUnique({ where: { id: parsed.data.driveId }, select: { id: true } });
    if (!drive) return NextResponse.json({ error: "validation_error", message: "Drive not found." }, { status: 400 });
  }
  if (parsed.data.eventId) {
    const event = await db.event.findUnique({ where: { id: parsed.data.eventId }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "validation_error", message: "Event not found." }, { status: 400 });
  }

  const expense = await db.placementExpense.create({
    data: {
      collegeId: session.collegeId,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      expenseDate: new Date(parsed.data.expenseDate),
      driveId: parsed.data.driveId || null,
      eventId: parsed.data.eventId || null,
      recordedById: session.userId,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "finance.expense_recorded",
    resourceType: "PlacementExpense",
    resourceId: expense.id,
    after: { category: expense.category, amount: parsed.data.amount },
  });

  return NextResponse.json({ ok: true, id: expense.id });
}
