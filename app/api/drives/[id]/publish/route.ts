import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import type { PermissionKey } from "@/lib/rbac/permissions";
import type { DriveStatus } from "@/lib/generated/prisma/client";
import { notifyUsers } from "@/lib/notify";

const ACTION_MAP: Record<string, { status: DriveStatus; permission: PermissionKey }> = {
  submit_approval: { status: "PENDING_APPROVAL", permission: "drive.submit_approval" },
  approve: { status: "APPROVED", permission: "drive.approve" },
  publish: { status: "PUBLISHED", permission: "drive.publish" },
  close: { status: "REGISTRATION_CLOSED", permission: "drive.close" },
  // Reopening is publishing again, so it is gated on drive.publish rather
  // than drive.close — closing and un-closing are not the same authority.
  reopen: { status: "PUBLISHED", permission: "drive.publish" },
  suspend: { status: "SUSPENDED", permission: "drive.suspend" },
  complete: { status: "COMPLETED", permission: "drive.close" },
  archive: { status: "ARCHIVED", permission: "drive.archive" },
  cancel: { status: "CANCELLED", permission: "drive.suspend" },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => ({ action: "publish" }));
  const { action } = body;
  const transition = ACTION_MAP[action as string];
  if (!transition) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    await requirePermission(session, transition.permission);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drive = await db.drive.update({
    where: { id },
    data: {
      status: transition.status,
      publishedAt: transition.status === "PUBLISHED" ? new Date() : undefined,
      // Reopening has to move the deadline too. /api/applications rejects on
      // BOTH the status and registrationClosesAt, so flipping the status back
      // while leaving a date in the past would produce a drive that looks
      // open and refuses every application. An absent date clears it, which
      // means "open until closed by hand".
      ...(action === "reopen"
        ? { registrationClosesAt: body.registrationClosesAt ? new Date(body.registrationClosesAt) : null }
        : {}),
      approvedAt: transition.status === "APPROVED" ? new Date() : undefined,
      submittedForApprovalAt: transition.status === "PENDING_APPROVAL" ? new Date() : undefined,
      historyEntries: { create: { actorId: session.userId, action: action === "reopen" ? "REGISTRATION_REOPENED" : `STATUS_CHANGED_TO_${transition.status}` } },
    },
    include: { company: true, eligibleCourses: { select: { courseId: true } } },
  });

  if (transition.status === "PUBLISHED") {
    const courseIds = drive.eligibleCourses.map((c) => c.courseId);
    const eligibleStudents = await db.student.findMany({
      where: { batchId: drive.batchId, courseId: { in: courseIds }, eligibleForPlacements: true, hasPlacementAccess: true },
      select: { userId: true },
    });
    await notifyUsers(
      db,
      session.collegeId,
      eligibleStudents.map((s) => s.userId),
      action === "reopen" ? "drive.reopened" : "drive.published",
      action === "reopen" ? "Registration reopened" : "New placement drive",
      action === "reopen"
        ? `${drive.company.name} — '${drive.title}' is accepting applications again`
        : `${drive.company.name} — '${drive.title}' has been published`,
      `/opportunities/${drive.id}`,
    );
  }

  return NextResponse.json({ ok: true, status: drive.status });
}
