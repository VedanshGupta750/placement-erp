// No "server-only" guard — kept usable from scripts/tests the same way
// lib/drives/counters.ts is.
import type { ApplicationStatus } from "@/lib/generated/prisma/client";
import { recomputeDriveCounters } from "@/lib/drives/counters";
import { notifyUser } from "@/lib/notify";

// Valid application state transitions — the ApplicationStatus enum is a
// straight line with one branch point (any active state can be withdrawn or
// rejected); nothing here jumps backwards.
const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  REGISTERED: ["APPLIED", "WITHDRAWN"],
  APPLIED: ["COLLEGE_APPROVED", "REJECTED", "WITHDRAWN"],
  COLLEGE_APPROVED: ["SCREENING", "SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SCREENING: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["ROUND_IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"],
  ROUND_IN_PROGRESS: ["SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const STATUS_MESSAGE: Partial<Record<ApplicationStatus, string>> = {
  COLLEGE_APPROVED: "Your application was approved by the placement cell",
  SCREENING: "Your application moved to screening",
  SHORTLISTED: "You've been shortlisted",
  SELECTED: "Congratulations — you've been selected",
  REJECTED: "Your application was not successful this time",
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// `db` is intentionally untyped (`any`) — this function is called with the
// tenant-scoped client, the raw platform client, and a $transaction `tx`
// from either, and unifying those three overload sets was blowing up
// TypeScript's comparison stack the same way lib/drives/counters.ts's did.
// The real type safety here comes from Prisma erroring loudly at the call
// site if a required relation is missing, not from this helper's signature.

// Applies an application status transition, writes the audit trail row,
// notifies the student, and keeps the drive's denormalised funnel counters
// in sync — the one place every status-changing route should go through
// instead of calling `application.update` directly.
export async function transitionApplication(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  collegeId: string,
  application: { id: string; driveId: string; status: ApplicationStatus },
  toStatus: ApplicationStatus,
  changedById: string,
  reason?: string,
) {
  if (!canTransition(application.status, toStatus)) {
    throw new Error(`Cannot move application from ${application.status} to ${toStatus}`);
  }

  const extra: Record<string, unknown> = {};
  if (toStatus === "COLLEGE_APPROVED") extra.approvedAt = new Date();
  if (toStatus === "WITHDRAWN") extra.withdrawnAt = new Date();

  const updated = await db.application.update({
    where: { id: application.id },
    data: { status: toStatus, ...extra },
    include: { student: { select: { userId: true } }, drive: { select: { title: true } } },
  });
  await db.applicationStatusHistory.create({
    data: { collegeId, applicationId: application.id, fromStatus: application.status, toStatus, reason, changedById },
  });
  await recomputeDriveCounters(db, application.driveId);

  const message = STATUS_MESSAGE[toStatus];
  if (message && updated.student?.userId) {
    await notifyUser(
      db,
      collegeId,
      updated.student.userId,
      `application.${toStatus.toLowerCase()}`,
      message,
      `${updated.drive.title}`,
      `/applications`,
    );
  }

  return updated;
}
