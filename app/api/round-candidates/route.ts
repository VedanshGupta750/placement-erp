import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { transitionApplication } from "@/lib/applications";

// Single-candidate counterpart to POST /api/drives/[id]/rounds/[roundId]/candidates
// (which bulk-assigns every shortlisted application to a round). This one
// exists for the Interview Detail page's "Schedule Next Round" button —
// after a candidate passes round N, assign them to round N+1 without
// touching every other shortlisted candidate on the drive.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.schedule");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const roundId = typeof body?.roundId === "string" ? body.roundId : "";
  if (!applicationId || !roundId) {
    return NextResponse.json({ error: "validation_error", message: "applicationId and roundId are required." }, { status: 400 });
  }

  const [application, round] = await Promise.all([
    db.application.findUnique({ where: { id: applicationId } }),
    db.selectionRound.findUnique({ where: { id: roundId } }),
  ]);
  if (!application || !round || round.driveId !== application.driveId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await db.roundCandidate.findUnique({ where: { roundId_applicationId: { roundId, applicationId } } }).catch(() => null);
  if (existing) {
    return NextResponse.json({ error: "already_assigned", message: "This candidate is already assigned to that round." }, { status: 409 });
  }

  const candidate = await db.roundCandidate.create({
    data: { collegeId: session.collegeId, roundId, applicationId, studentId: application.studentId, status: "ASSIGNED" },
  });

  if (application.status === "SHORTLISTED") {
    await transitionApplication(db, session.collegeId, application, "ROUND_IN_PROGRESS", session.userId, `Assigned to round: ${round.name}`);
  }

  return NextResponse.json({ ok: true, id: candidate.id });
}
