import { NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { recordAuthAudit, authRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  // Read the session before clearing it, so the trail records who left.
  const session = await getSession();
  await deleteSession();

  if (session) {
    await recordAuthAudit(getTenantDb(session.collegeId), {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "auth.logout",
      ...authRequestContext(request),
    });
  }

  return NextResponse.json({ ok: true });
}
