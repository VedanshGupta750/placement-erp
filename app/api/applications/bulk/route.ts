import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { canTransition, transitionApplication } from "@/lib/applications";
import { notifyUsers } from "@/lib/notify";
import type { ApplicationStatus } from "@/lib/generated/prisma/client";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const applicationIds: string[] = Array.isArray(body?.applicationIds) ? body.applicationIds : [];
  const action = body?.action;
  const payload = body?.payload ?? {};

  if (applicationIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one application." }, { status: 400 });
  }
  if (applicationIds.length > 1000) {
    return NextResponse.json({ error: "validation_error", message: "Bulk actions are limited to 1000 applications at a time." }, { status: 400 });
  }

  const applications = await db.application.findMany({
    where: { id: { in: applicationIds } },
    select: { id: true, status: true, driveId: true, student: { select: { userId: true } } },
  });
  if (applications.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let successCount = 0;
  let skipped = 0;

  if (action === "shortlist" || action === "reject") {
    const permission = action === "shortlist" ? "application.shortlist" : "application.reject";
    try {
      await requirePermission(session, permission);
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const target: ApplicationStatus = action === "shortlist" ? "SHORTLISTED" : "REJECTED";
    const reason = typeof payload.reason === "string" ? payload.reason.trim() || undefined : undefined;
    for (const a of applications) {
      if (!canTransition(a.status, target)) {
        skipped += 1;
        continue;
      }
      await transitionApplication(db, session.collegeId, a, target, session.userId, reason);
      successCount += 1;
    }
    return NextResponse.json({ ok: true, successCount, skipped });
  }

  if (action === "assign_owner") {
    try {
      await requirePermission(session, "application.approve");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const ownerId = typeof payload.ownerId === "string" ? payload.ownerId : "";
    if (!ownerId) return NextResponse.json({ error: "validation_error", message: "Pick a staff member." }, { status: 400 });
    const owner = await db.user.findUnique({ where: { id: ownerId }, select: { userType: true } });
    if (!owner || owner.userType !== "PLACEMENT_TEAM") {
      return NextResponse.json({ error: "validation_error", message: "That user isn't a placement-team member." }, { status: 400 });
    }
    const result = await db.application.updateMany({ where: { id: { in: applicationIds } }, data: { ownerId } });
    return NextResponse.json({ ok: true, successCount: result.count });
  }

  if (action === "set_priority") {
    try {
      await requirePermission(session, "application.approve");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const priority = typeof payload.priority === "string" ? payload.priority : "";
    if (!["NORMAL", "HIGH", "URGENT"].includes(priority)) {
      return NextResponse.json({ error: "validation_error", message: "Invalid priority." }, { status: 400 });
    }
    const result = await db.application.updateMany({ where: { id: { in: applicationIds } }, data: { priority } });
    return NextResponse.json({ ok: true, successCount: result.count });
  }

  if (action === "send_message") {
    try {
      await requirePermission(session, "message.send");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    const messageBody = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!subject || !messageBody) {
      return NextResponse.json({ error: "validation_error", message: "Subject and message are required." }, { status: 400 });
    }
    const userIds = applications.map((a: { student: { userId: string } }) => a.student.userId);
    await notifyUsers(db, session.collegeId, userIds, "application.bulk_message", subject, messageBody, "/applications");
    return NextResponse.json({ ok: true, successCount: userIds.length });
  }

  return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
}
