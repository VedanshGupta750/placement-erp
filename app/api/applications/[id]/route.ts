import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { withdrawApplicationSchema } from "@/lib/validators/application";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { transitionApplication } from "@/lib/applications";
import type { ApplicationStatus } from "@/lib/generated/prisma/client";

// Students can only withdraw their own application, and only while it's
// still early in the funnel — see WITHDRAWABLE below. Any other status
// transition (approve/shortlist/reject/...) is TPO-console territory.
const WITHDRAWABLE = new Set(["REGISTERED", "APPLIED", "COLLEGE_APPROVED", "SCREENING"]);

const STAGE_PERMISSION: Partial<Record<ApplicationStatus, string>> = {
  COLLEGE_APPROVED: "application.approve",
  SCREENING: "application.approve",
  SHORTLISTED: "application.shortlist",
  SELECTED: "application.move_round",
  REJECTED: "application.reject",
  WITHDRAWN: "application.approve",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  // No `action` field, just {status:"WITHDRAWN"} — the original student
  // self-service withdraw call shape (components/applications/
  // withdraw-button.tsx), kept byte-for-byte so it isn't broken by the
  // newer staff-side actions added below.
  if (!action) {
    const parsed = withdrawApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error", message: "Only withdrawing an application is supported here." }, { status: 400 });
    }

    const student = await db.student.findUnique({ where: { userId: session.userId } });
    if (!student) {
      return NextResponse.json({ error: "not_a_student" }, { status: 403 });
    }

    try {
      await requirePermission(session, "application.withdraw");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }

    const application = await db.application.findUnique({ where: { id } });
    if (!application || application.studentId !== student.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!WITHDRAWABLE.has(application.status)) {
      return NextResponse.json(
        { error: "invalid_transition", message: "This application can no longer be withdrawn." },
        { status: 409 },
      );
    }

    await db.$transaction(async (tx) => {
      await tx.application.update({
        where: { id },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      });
      await tx.applicationStatusHistory.create({
        data: {
          collegeId: session.collegeId,
          applicationId: id,
          fromStatus: application.status,
          toStatus: "WITHDRAWN",
          reason: "Withdrawn by student",
          changedById: session.userId,
        },
      });
    });

    await recomputeDriveCounters(db, application.driveId);

    return NextResponse.json({ ok: true });
  }

  // Everything below is staff-side (application.approve/shortlist/reject/
  // move_round) — the application lookup happens per-branch since each
  // needs different fields/permission checks.
  const application = await db.application.findUnique({ where: { id } });
  if (!application) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "move_stage") {
    const target = body?.status as ApplicationStatus;
    const permission = STAGE_PERMISSION[target];
    if (!permission) return NextResponse.json({ error: "validation_error", message: "Invalid target stage." }, { status: 400 });
    try {
      await requirePermission(session, permission as Parameters<typeof requirePermission>[1]);
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    try {
      const reason = typeof body?.reason === "string" ? body.reason.trim() || undefined : undefined;
      const updated = await transitionApplication(db, session.collegeId, application, target, session.userId, reason);
      return NextResponse.json({ ok: true, status: updated.status });
    } catch (e) {
      return NextResponse.json({ error: "invalid_transition", message: (e as Error).message }, { status: 409 });
    }
  }

  if (action === "set_priority") {
    try {
      await requirePermission(session, "application.approve");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const priority = body?.priority;
    if (!["NORMAL", "HIGH", "URGENT"].includes(priority)) {
      return NextResponse.json({ error: "validation_error", message: "Invalid priority." }, { status: 400 });
    }
    await db.application.update({ where: { id }, data: { priority } });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_owner") {
    try {
      await requirePermission(session, "application.approve");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : null;
    await db.application.update({ where: { id }, data: { ownerId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
}
