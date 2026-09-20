import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { scheduleCandidateSchema, scoreCandidateSchema, cancelCandidateSchema, noShowCandidateSchema } from "@/lib/validators/round";
import { transitionApplication } from "@/lib/applications";
import { notifyUser } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { findScheduleConflicts } from "@/lib/interviews/conflicts";

const ACTIVE_STATUSES = ["ASSIGNED", "SCHEDULED", "CHECKED_IN"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => ({}));
  const action = body.action as "schedule" | "reschedule" | "score" | "checkin" | "start" | "end" | "cancel" | "remind" | "no_show";

  const candidate = await db.roundCandidate.findUnique({
    where: { id },
    include: {
      application: true,
      round: { select: { name: true, driveId: true, drive: { select: { title: true } } } },
      student: { select: { userId: true } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "schedule" || action === "reschedule") {
    try {
      await requirePermission(session, action === "schedule" ? "interview.schedule" : "interview.reschedule");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const parsed = scheduleCandidateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });

    // A linked staff account (interviewerId) is the source of truth for
    // display name unless the caller explicitly typed an override — lets a
    // TPO link a real account but still relabel them ("Dr. Sharma") if needed.
    let interviewerName = parsed.data.interviewerName;
    if (parsed.data.interviewerId && !interviewerName) {
      const interviewerUser = await db.user.findUnique({ where: { id: parsed.data.interviewerId }, select: { name: true } });
      interviewerName = interviewerUser?.name;
    }

    if (parsed.data.scheduledAt && !body.confirmed) {
      const conflicts = await findScheduleConflicts(db, {
        scheduledAt: new Date(parsed.data.scheduledAt),
        interviewerId: parsed.data.interviewerId,
        interviewerName: parsed.data.interviewerId ? null : interviewerName,
        studentId: candidate.studentId,
        excludeCandidateId: id,
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ needsConfirmation: true, conflicts });
      }
    }

    const before = { scheduledAt: candidate.scheduledAt, interviewerName: candidate.interviewerName, interviewerId: candidate.interviewerId, mode: candidate.mode, venue: candidate.venue, meetingUrl: candidate.meetingUrl };

    await db.roundCandidate.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        mode: parsed.data.mode,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
        venue: parsed.data.venue,
        meetingUrl: parsed.data.meetingUrl,
        interviewerName,
        interviewerId: parsed.data.interviewerId ?? null,
      },
    });

    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: action === "schedule" ? "interview.scheduled" : "interview.rescheduled",
      resourceType: "RoundCandidate",
      resourceId: id,
      after: { before, after: parsed.data },
    });

    if (parsed.data.scheduledAt) {
      const when = new Date(parsed.data.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      await notifyUser(
        db,
        session.collegeId,
        candidate.student.userId,
        action === "schedule" ? "interview.scheduled" : "interview.rescheduled",
        action === "schedule" ? `Interview scheduled: ${candidate.round.name}` : `Interview rescheduled: ${candidate.round.name}`,
        `Your "${candidate.round.name}" round for "${candidate.round.drive.title}" is ${action === "schedule" ? "scheduled" : "now rescheduled"} for ${when}.`,
        `/opportunities/${candidate.round.driveId}`,
      );
      if (parsed.data.interviewerId) {
        await notifyUser(
          db,
          session.collegeId,
          parsed.data.interviewerId,
          "interview.assigned",
          "New interview assigned to you",
          `${candidate.round.name} for "${candidate.round.drive.title}" is scheduled for ${when}.`,
          "/my-interviews",
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "checkin") {
    try {
      await requirePermission(session, "interview.schedule");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (!["SCHEDULED"].includes(candidate.status)) {
      return NextResponse.json({ error: "invalid_transition", message: "Only a scheduled candidate can be checked in." }, { status: 409 });
    }
    await db.roundCandidate.update({ where: { id }, data: { status: "CHECKED_IN", checkedInAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === "start") {
    try {
      await requirePermission(session, "round.score");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (!["SCHEDULED", "CHECKED_IN"].includes(candidate.status)) {
      return NextResponse.json({ error: "invalid_transition", message: "This interview can't be started from its current status." }, { status: 409 });
    }
    await db.roundCandidate.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === "end") {
    try {
      await requirePermission(session, "round.score");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (candidate.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "invalid_transition", message: "This interview isn't in progress." }, { status: 409 });
    }
    await db.roundCandidate.update({ where: { id }, data: { status: "COMPLETED", endedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    try {
      await requirePermission(session, "interview.cancel");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (!ACTIVE_STATUSES.includes(candidate.status)) {
      return NextResponse.json({ error: "invalid_transition", message: "Only an unstarted interview can be cancelled." }, { status: 409 });
    }
    const parsed = cancelCandidateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "validation_error" }, { status: 400 });
    await db.roundCandidate.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: parsed.data.reason } });
    await recordAudit(db, { collegeId: session.collegeId, actorId: session.userId, action: "interview.cancelled", resourceType: "RoundCandidate", resourceId: id, reason: parsed.data.reason });
    await notifyUser(db, session.collegeId, candidate.student.userId, "interview.cancelled", `Interview cancelled: ${candidate.round.name}`, `Your "${candidate.round.name}" round for "${candidate.round.drive.title}" has been cancelled.`, `/opportunities/${candidate.round.driveId}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "remind") {
    try {
      await requirePermission(session, "interview.schedule");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (!candidate.scheduledAt) {
      return NextResponse.json({ error: "invalid_transition", message: "This candidate isn't scheduled yet." }, { status: 409 });
    }
    const when = new Date(candidate.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    await notifyUser(db, session.collegeId, candidate.student.userId, "interview.reminder", `Reminder: ${candidate.round.name} interview`, `Your "${candidate.round.name}" round for "${candidate.round.drive.title}" is at ${when}.`, `/opportunities/${candidate.round.driveId}`);
    await db.roundCandidate.update({ where: { id }, data: { reminderSentAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === "no_show") {
    try {
      await requirePermission(session, "round.score");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (!["SCHEDULED", "CHECKED_IN"].includes(candidate.status)) {
      return NextResponse.json({ error: "invalid_transition", message: "Only a scheduled candidate can be marked no-show." }, { status: 409 });
    }
    const parsed = noShowCandidateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "validation_error" }, { status: 400 });
    await db.roundCandidate.update({ where: { id }, data: { status: "NO_SHOW", noShowReason: parsed.data.reason, resultPublishedAt: new Date() } });
    await recordAudit(db, { collegeId: session.collegeId, actorId: session.userId, action: "interview.no_show", resourceType: "RoundCandidate", resourceId: id, reason: parsed.data.reason });
    return NextResponse.json({ ok: true });
  }

  if (action === "score") {
    try {
      await requirePermission(session, "round.score");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const parsed = scoreCandidateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });

    // When criteriaScores is present, it's the source of truth — the
    // overall score is always recomputed from it server-side (average of
    // 0-10 criteria, scaled to /100), so a client can't submit a
    // criteria breakdown that doesn't match its own overall score.
    const criteriaValues = parsed.data.criteriaScores ? Object.values(parsed.data.criteriaScores) : null;
    const computedScore = criteriaValues && criteriaValues.length > 0
      ? Math.round((criteriaValues.reduce((s, v) => s + v, 0) / criteriaValues.length) * 10)
      : parsed.data.score;

    await db.roundCandidate.update({
      where: { id },
      data: {
        status: parsed.data.result,
        score: computedScore,
        feedback: parsed.data.feedback,
        strengths: parsed.data.strengths,
        weaknesses: parsed.data.weaknesses,
        recommendation: parsed.data.recommendation,
        criteriaScores: parsed.data.criteriaScores,
        resultPublishedAt: new Date(),
      },
    });

    await recordAudit(db, { collegeId: session.collegeId, actorId: session.userId, action: "interview.evaluated", resourceType: "RoundCandidate", resourceId: id, after: { result: parsed.data.result, score: computedScore } });

    // A FAILED round result rejects the application outright; a PASSED
    // result just records progress — the TPO separately marks the
    // application SELECTED once all rounds are done (see applicants panel).
    if (parsed.data.result === "FAILED" && candidate.application.status !== "REJECTED") {
      await transitionApplication(db, session.collegeId, candidate.application, "REJECTED", session.userId, "Failed selection round");
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
