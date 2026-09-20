import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { getStudentScopeWhere } from "@/lib/students/scope";
import { computeMatchScore } from "@/lib/matching";
import { recomputeDriveCounters } from "@/lib/drives/counters";

type BulkAction = "add_tag" | "change_status" | "send_message" | "assign_coordinator" | "add_to_drive";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.bulk_update");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
  const action: BulkAction = body?.action;
  const payload = body?.payload ?? {};

  if (studentIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one student." }, { status: 400 });
  }
  if (studentIds.length > 1000) {
    return NextResponse.json({ error: "validation_error", message: "Bulk actions are limited to 1000 students at a time." }, { status: 400 });
  }

  // A Department Coordinator can only bulk-act on students within their own
  // scope — silently drops any selected id outside it, same fail-closed
  // rule as the list/detail pages.
  const scopeWhere = await getStudentScopeWhere(db, session);
  const students = await db.student.findMany({
    where: { id: { in: studentIds }, ...scopeWhere },
    select: { id: true, tags: true, userId: true },
  });
  if (students.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let successCount = 0;

  if (action === "add_tag") {
    const tag = typeof payload.tag === "string" ? payload.tag.trim() : "";
    if (!tag) return NextResponse.json({ error: "validation_error", message: "Tag is required." }, { status: 400 });
    for (const s of students) {
      if (s.tags.includes(tag)) continue;
      await db.student.update({ where: { id: s.id }, data: { tags: { push: tag } } });
      successCount += 1;
    }
  } else if (action === "change_status") {
    const status = typeof payload.placementStatus === "string" ? payload.placementStatus : "";
    if (!["SEEKING", "PLACED", "NOT_INTERESTED", "OPTED_OUT"].includes(status)) {
      return NextResponse.json({ error: "validation_error", message: "Invalid placement status." }, { status: 400 });
    }
    await db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { placementStatus: status } });
    successCount = students.length;
  } else if (action === "send_message") {
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const messageBody = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!title || !messageBody) {
      return NextResponse.json({ error: "validation_error", message: "Title and message are required." }, { status: 400 });
    }
    await notifyUsers(db, session.collegeId, students.map((s) => s.userId), "student.bulk_message", title, messageBody, "/students");
    successCount = students.length;
  } else if (action === "assign_coordinator") {
    const coordinatorId = typeof payload.coordinatorId === "string" ? payload.coordinatorId : "";
    if (!coordinatorId) return NextResponse.json({ error: "validation_error", message: "Pick a coordinator." }, { status: 400 });
    const coordinator = await db.user.findUnique({ where: { id: coordinatorId } });
    if (!coordinator) return NextResponse.json({ error: "validation_error", message: "That user doesn't exist." }, { status: 400 });
    await db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { assignedCoordinatorId: coordinatorId } });
    successCount = students.length;
    await notifyUsers(
      db,
      session.collegeId,
      students.map((s) => s.userId),
      "student.coordinator_assigned",
      "Coordinator assigned",
      `${coordinator.name} has been assigned as your placement coordinator.`,
      "/profile",
    );
  } else if (action === "add_to_drive") {
    // Same TPO-side override rationale as the single-student
    // /api/students/[id]/applications route: deliberately skips the
    // eligibility engine (a TPO bulk-adding a shortlisted set is an
    // explicit decision), gated on application.approve on top of
    // student.bulk_update since this is placement-operational, not just a
    // generic roster edit.
    try {
      await requirePermission(session, "application.approve");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const driveId = typeof payload.driveId === "string" ? payload.driveId : "";
    const positionId = typeof payload.positionId === "string" ? payload.positionId : "";
    if (!driveId || !positionId) {
      return NextResponse.json({ error: "validation_error", message: "Pick a drive and a position." }, { status: 400 });
    }
    const drive = await db.drive.findUnique({
      where: { id: driveId },
      include: { positions: true, requiredSkills: { include: { skill: true } } },
    });
    if (!drive) return NextResponse.json({ error: "not_found", message: "Drive not found." }, { status: 404 });
    const position = drive.positions.find((p: { id: string }) => p.id === positionId);
    if (!position) return NextResponse.json({ error: "validation_error", message: "That position isn't part of this drive." }, { status: 400 });

    const alreadyApplied = await db.application.findMany({
      where: { driveId, studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true },
    });
    const alreadyAppliedIds = new Set(alreadyApplied.map((a: { studentId: string }) => a.studentId));

    const addedUserIds: string[] = [];
    for (const s of students) {
      if (alreadyAppliedIds.has(s.id)) continue;
      const studentSkills = await db.studentSkill.findMany({ where: { studentId: s.id }, include: { skill: true } });
      const { matchScore, matchedSkills, missingSkills } = computeMatchScore(
        studentSkills.map((sk: { skill: { name: string } }) => sk.skill.name),
        drive.requiredSkills.map((sk: { skill: { name: string } }) => sk.skill.name),
      );
      await db.application.create({
        data: {
          collegeId: session.collegeId,
          studentId: s.id,
          driveId,
          positionId,
          status: "APPLIED",
          matchScore,
          matchedSkills,
          missingSkills,
          statusHistory: { create: { collegeId: session.collegeId, toStatus: "APPLIED", changedById: session.userId } },
        },
      });
      addedUserIds.push(s.userId);
      successCount += 1;
    }
    if (successCount > 0) {
      await recomputeDriveCounters(db, driveId);
      await notifyUsers(
        db,
        session.collegeId,
        addedUserIds,
        "application.added_by_staff",
        `Added to ${drive.title}`,
        `You've been added to "${drive.title}" (${position.title}) by placement staff.`,
        "/applications",
      );
    }
  } else {
    return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
  }

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.bulk_action",
    resourceType: "Student",
    resourceId: null,
    after: { action, studentCount: successCount, payload },
  });

  return NextResponse.json({ ok: true, successCount });
}
