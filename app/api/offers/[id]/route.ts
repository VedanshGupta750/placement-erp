import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { respondToOfferSchema } from "@/lib/validators/offer";
import type { OfferStatus } from "@/lib/generated/prisma/client";

// Students may only move ISSUED -> ACCEPTED or ISSUED -> DECLINED on their
// own offer. JOINING_PENDING/JOINED tracking is TPO/PC scope, built
// elsewhere.
const ACTION_MAP: Record<string, { status: OfferStatus; permission: PermissionKey }> = {
  accept: { status: "ACCEPTED", permission: "offer.accept" },
  decline: { status: "DECLINED", permission: "offer.decline" },
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId } });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = respondToOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const transition = ACTION_MAP[parsed.data.action];

  try {
    await requirePermission(session, transition.permission);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const offer = await db.offer.findUnique({ where: { id } });
  if (!offer || offer.studentId !== student.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (offer.status !== "ISSUED") {
    return NextResponse.json(
      { error: "invalid_transition", message: "This offer can no longer be responded to." },
      { status: 409 },
    );
  }

  const updated = await db.offer.update({
    where: { id },
    data: {
      status: transition.status,
      acceptedAt: transition.status === "ACCEPTED" ? new Date() : undefined,
      declinedAt: transition.status === "DECLINED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
