import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { transitionApplication } from "@/lib/applications";

// Bulk-assigns every SHORTLISTED (or already ROUND_IN_PROGRESS, for a later
// round) application to this round, and moves fresh SHORTLISTED ones into
// ROUND_IN_PROGRESS in the same pass.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const session = await requireSession();
  const { id: driveId, roundId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.schedule");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const round = await db.selectionRound.findUnique({ where: { id: roundId, driveId } });
  if (!round) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const applications = await db.application.findMany({
    where: { driveId, status: { in: ["SHORTLISTED", "ROUND_IN_PROGRESS"] } },
    select: { id: true, driveId: true, studentId: true, status: true },
  });

  const existing = await db.roundCandidate.findMany({ where: { roundId }, select: { applicationId: true } });
  const existingIds = new Set(existing.map((e) => e.applicationId));
  const toAssign = applications.filter((a) => !existingIds.has(a.id));

  await db.roundCandidate.createMany({
    data: toAssign.map((a) => ({ collegeId: session.collegeId, roundId, applicationId: a.id, studentId: a.studentId, status: "ASSIGNED" as const })),
  });

  for (const a of toAssign) {
    if (a.status === "SHORTLISTED") {
      await transitionApplication(db, session.collegeId, a, "ROUND_IN_PROGRESS", session.userId, `Assigned to round: ${round.name}`);
    }
  }

  if (round.status === "DRAFT") {
    await db.selectionRound.update({ where: { id: roundId }, data: { status: "SCHEDULED" } });
  }

  return NextResponse.json({ ok: true, assigned: toAssign.length });
}
