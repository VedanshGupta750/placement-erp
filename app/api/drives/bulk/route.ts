import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import type { PermissionKey } from "@/lib/rbac/permissions";
import type { DriveStatus } from "@/lib/generated/prisma/client";
import { notifyUsers } from "@/lib/notify";

// Same transition set as /api/drives/[id]/publish, applied to many drives
// at once — reuses the exact same status/permission map so bulk and
// single-drive actions can never drift apart.
const STATUS_ACTION_MAP: Record<string, { status: DriveStatus; permission: PermissionKey }> = {
  publish: { status: "PUBLISHED", permission: "drive.publish" },
  close: { status: "REGISTRATION_CLOSED", permission: "drive.close" },
  archive: { status: "ARCHIVED", permission: "drive.archive" },
};

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const driveIds: string[] = Array.isArray(body?.driveIds) ? body.driveIds : [];
  const action = body?.action;
  const payload = body?.payload ?? {};

  if (driveIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one drive." }, { status: 400 });
  }
  if (driveIds.length > 500) {
    return NextResponse.json({ error: "validation_error", message: "Bulk actions are limited to 500 drives at a time." }, { status: 400 });
  }

  if (action === "assign_owner") {
    try {
      await requirePermission(session, "drive.edit");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const ownerId = typeof payload.ownerId === "string" ? payload.ownerId : "";
    if (!ownerId) return NextResponse.json({ error: "validation_error", message: "Pick a staff member." }, { status: 400 });
    const owner = await db.user.findUnique({ where: { id: ownerId }, select: { id: true, userType: true } });
    if (!owner || owner.userType !== "PLACEMENT_TEAM") {
      return NextResponse.json({ error: "validation_error", message: "That user isn't a placement-team member." }, { status: 400 });
    }
    const result = await db.drive.updateMany({ where: { id: { in: driveIds } }, data: { ownerId } });
    return NextResponse.json({ ok: true, successCount: result.count });
  }

  if (action === "broadcast") {
    try {
      await requirePermission(session, "broadcast.send");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    const messageBody = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!subject || !messageBody) {
      return NextResponse.json({ error: "validation_error", message: "Subject and message are required." }, { status: 400 });
    }

    const drives = await db.drive.findMany({ where: { id: { in: driveIds } }, select: { id: true, title: true } });
    let recipientCount = 0;
    for (const drive of drives) {
      const applications = await db.application.findMany({ where: { driveId: drive.id }, select: { student: { select: { userId: true } } } });
      const userIds = applications.map((a: { student: { userId: string } }) => a.student.userId);
      if (userIds.length === 0) continue;
      await notifyUsers(db, session.collegeId, userIds, "drive.broadcast", subject, messageBody, `/opportunities/${drive.id}`);
      recipientCount += userIds.length;
    }
    return NextResponse.json({ ok: true, successCount: drives.length, recipientCount });
  }

  if (action === "delete") {
    try {
      await requirePermission(session, "drive.archive");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    // Only ever delete drafts — a drive with real applications/offers/
    // interviews is never safe to hard-delete, that's what Archive is for.
    const drives = await db.drive.findMany({ where: { id: { in: driveIds }, status: "DRAFT" }, select: { id: true } });
    const skipped = driveIds.length - drives.length;
    if (drives.length > 0) {
      await db.drive.deleteMany({ where: { id: { in: drives.map((d) => d.id) } } });
    }
    return NextResponse.json({ ok: true, successCount: drives.length, skipped });
  }

  const transition = STATUS_ACTION_MAP[action as string];
  if (!transition) {
    return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
  }

  try {
    await requirePermission(session, transition.permission);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drives = await db.drive.findMany({ where: { id: { in: driveIds } }, select: { id: true } });
  let successCount = 0;
  for (const d of drives) {
    await db.drive.update({
      where: { id: d.id },
      data: {
        status: transition.status,
        publishedAt: transition.status === "PUBLISHED" ? new Date() : undefined,
        historyEntries: { create: { actorId: session.userId, action: `STATUS_CHANGED_TO_${transition.status}` } },
      },
    });
    successCount += 1;
  }

  return NextResponse.json({ ok: true, successCount });
}
