import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { scheduleCandidateSchema } from "@/lib/validators/round";
import { notifyUser } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { transitionApplication } from "@/lib/applications";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const candidateIds: string[] = Array.isArray(body?.candidateIds) ? body.candidateIds : [];
  const action = body?.action ?? "schedule";
  if (candidateIds.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "Select at least one candidate." }, { status: 400 });
  }
  if (candidateIds.length > 500) {
    return NextResponse.json({ error: "validation_error", message: "Bulk actions are limited to 500 candidates at a time." }, { status: 400 });
  }

  if (action === "schedule") {
    try {
      await requirePermission(session, "interview.schedule");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const parsed = scheduleCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    let interviewerName = parsed.data.interviewerName;
    if (parsed.data.interviewerId && !interviewerName) {
      const interviewerUser = await db.user.findUnique({ where: { id: parsed.data.interviewerId }, select: { name: true } });
      interviewerName = interviewerUser?.name;
    }

    // Only touches candidates still ASSIGNED, so it can never silently
    // overwrite a slot someone already scheduled individually.
    const candidates = await db.roundCandidate.findMany({
      where: { id: { in: candidateIds }, status: "ASSIGNED" },
      include: { round: { select: { name: true, driveId: true, drive: { select: { title: true } } } }, student: { select: { userId: true } } },
    });
    const skipped = candidateIds.length - candidates.length;
    if (candidates.length === 0) {
      return NextResponse.json({ error: "validation_error", message: "None of the selected candidates are awaiting scheduling." }, { status: 400 });
    }

    await db.roundCandidate.updateMany({
      where: { id: { in: candidates.map((c: { id: string }) => c.id) } },
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

    if (parsed.data.scheduledAt) {
      const when = new Date(parsed.data.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      await Promise.all(
        candidates.map((c: { round: { name: string; driveId: string; drive: { title: string } }; student: { userId: string } }) =>
          notifyUser(db, session.collegeId, c.student.userId, "interview.scheduled", `Interview scheduled: ${c.round.name}`, `Your "${c.round.name}" round for "${c.round.drive.title}" is scheduled for ${when}.`, `/opportunities/${c.round.driveId}`),
        ),
      );
      if (parsed.data.interviewerId) {
        await notifyUser(db, session.collegeId, parsed.data.interviewerId, "interview.assigned", "New interviews assigned to you", `${candidates.length} interview(s) scheduled for ${when}.`, "/my-interviews");
      }
    }

    return NextResponse.json({ ok: true, successCount: candidates.length, skipped });
  }

  if (action === "remind") {
    try {
      await requirePermission(session, "interview.schedule");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const candidates = await db.roundCandidate.findMany({
      where: { id: { in: candidateIds }, scheduledAt: { not: null } },
      include: { round: { select: { name: true, driveId: true, drive: { select: { title: true } } } }, student: { select: { userId: true } } },
    });
    const skipped = candidateIds.length - candidates.length;
    await Promise.all(
      candidates.map((c: { id: string; scheduledAt: Date | null; round: { name: string; driveId: string; drive: { title: string } }; student: { userId: string } }) => {
        const when = new Date(c.scheduledAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
        return notifyUser(db, session.collegeId, c.student.userId, "interview.reminder", `Reminder: ${c.round.name} interview`, `Your "${c.round.name}" round for "${c.round.drive.title}" is at ${when}.`, `/opportunities/${c.round.driveId}`);
      }),
    );
    await db.roundCandidate.updateMany({ where: { id: { in: candidates.map((c: { id: string }) => c.id) } }, data: { reminderSentAt: new Date() } });
    return NextResponse.json({ ok: true, successCount: candidates.length, skipped });
  }

  if (action === "cancel") {
    try {
      await requirePermission(session, "interview.cancel");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const reason = typeof body?.reason === "string" ? body.reason.trim() || undefined : undefined;
    const candidates = await db.roundCandidate.findMany({
      where: { id: { in: candidateIds }, status: { in: ["ASSIGNED", "SCHEDULED", "CHECKED_IN"] } },
      include: { round: { select: { name: true, driveId: true, drive: { select: { title: true } } } }, student: { select: { userId: true } } },
    });
    const skipped = candidateIds.length - candidates.length;
    if (candidates.length === 0) {
      return NextResponse.json({ error: "validation_error", message: "None of the selected candidates can be cancelled." }, { status: 400 });
    }
    await db.roundCandidate.updateMany({ where: { id: { in: candidates.map((c: { id: string }) => c.id) } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    await recordAudit(db, { collegeId: session.collegeId, actorId: session.userId, action: "interview.bulk_action", resourceType: "RoundCandidate", after: { action: "cancel", count: candidates.length }, reason });
    return NextResponse.json({ ok: true, successCount: candidates.length, skipped });
  }

  if (action === "mark_passed" || action === "mark_failed") {
    try {
      await requirePermission(session, "round.score");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    const result = action === "mark_passed" ? "PASSED" : "FAILED";
    const candidates = await db.roundCandidate.findMany({
      where: { id: { in: candidateIds }, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] } },
      include: { application: true },
    });
    const skipped = candidateIds.length - candidates.length;
    if (candidates.length === 0) {
      return NextResponse.json({ error: "validation_error", message: "None of the selected candidates can be marked." }, { status: 400 });
    }
    await db.roundCandidate.updateMany({ where: { id: { in: candidates.map((c: { id: string }) => c.id) } }, data: { status: result, resultPublishedAt: new Date() } });
    if (result === "FAILED") {
      await Promise.all(
        candidates
          .filter((c: { application: { status: string } }) => c.application.status !== "REJECTED")
          .map((c: { application: Parameters<typeof transitionApplication>[2] }) => transitionApplication(db, session.collegeId, c.application, "REJECTED", session.userId, "Failed selection round")),
      );
    }
    await recordAudit(db, { collegeId: session.collegeId, actorId: session.userId, action: "interview.bulk_action", resourceType: "RoundCandidate", after: { action: result, count: candidates.length } });
    return NextResponse.json({ ok: true, successCount: candidates.length, skipped });
  }

  return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
}
