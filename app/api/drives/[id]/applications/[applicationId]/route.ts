import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import type { PermissionKey } from "@/lib/rbac/permissions";
import type { ApplicationStatus } from "@/lib/generated/prisma/client";
import { transitionApplication } from "@/lib/applications";

const ACTION_MAP: Record<string, { status: ApplicationStatus; permission: PermissionKey }> = {
  approve: { status: "COLLEGE_APPROVED", permission: "application.approve" },
  screen: { status: "SCREENING", permission: "application.approve" },
  shortlist: { status: "SHORTLISTED", permission: "application.shortlist" },
  select: { status: "SELECTED", permission: "application.move_round" },
  reject: { status: "REJECTED", permission: "application.reject" },
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; applicationId: string }> }) {
  const session = await requireSession();
  const { id: driveId, applicationId } = await params;
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => ({}));
  const transition = ACTION_MAP[body.action as string];
  if (!transition) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    await requirePermission(session, transition.permission);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const application = await db.application.findUnique({ where: { id: applicationId, driveId } });
  if (!application) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await transitionApplication(db, session.collegeId, application, transition.status, session.userId, body.reason);
  } catch (e) {
    return NextResponse.json({ error: "invalid_transition", message: (e as Error).message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
