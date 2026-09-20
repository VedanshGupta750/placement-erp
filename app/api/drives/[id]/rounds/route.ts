import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createRoundSchema } from "@/lib/validators/round";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const lastRound = await db.selectionRound.findFirst({ where: { driveId }, orderBy: { sequenceNo: "desc" }, select: { sequenceNo: true } });
  const round = await db.selectionRound.create({
    data: {
      collegeId: session.collegeId,
      driveId,
      name: parsed.data.name,
      roundType: parsed.data.roundType,
      sequenceNo: (lastRound?.sequenceNo ?? 0) + 1,
      status: "DRAFT",
      scheduledStart: parsed.data.scheduledStart ? new Date(parsed.data.scheduledStart) : undefined,
      scheduledEnd: parsed.data.scheduledEnd ? new Date(parsed.data.scheduledEnd) : undefined,
    },
  });

  return NextResponse.json({ ok: true, id: round.id });
}
