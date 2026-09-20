import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { updateUserProfileSchema } from "@/lib/validators/profile";

// Self-service — any signed-in user (student or staff) can edit their own
// name/phone/LinkedIn. No RBAC permission check needed since it only ever
// touches session.userId's own row, never anyone else's.
export async function PATCH(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const parsed = updateUserProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await db.user.update({ where: { id: session.userId }, data: parsed.data });

  return NextResponse.json({ ok: true });
}
