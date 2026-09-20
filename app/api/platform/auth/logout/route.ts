import { NextResponse } from "next/server";
import { getPlatformSession, deletePlatformSession } from "@/lib/auth/platform-session";
import { recordPlatformAudit, requestContext, PLATFORM_AUDIT_ACTIONS } from "@/lib/auth/platform-audit";

export async function POST(request: Request) {
  // Read the session before clearing it, so the trail records who left.
  const admin = await getPlatformSession();
  await deletePlatformSession();

  if (admin) {
    await recordPlatformAudit({
      platformAdminId: admin.id,
      actorEmail: admin.email,
      action: PLATFORM_AUDIT_ACTIONS.LOGOUT,
      ...requestContext(request),
    });
  }

  return NextResponse.json({ ok: true });
}
