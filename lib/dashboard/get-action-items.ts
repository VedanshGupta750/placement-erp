// No "server-only" guard — kept usable the same way lib/applications.ts and
// lib/notify.ts are. Computes the TPO dashboard "Action Center" list: one
// entry per category of thing that needs a placement officer's attention,
// with real counts pulled from the tenant-scoped Prisma client. Categories
// with a zero count are omitted entirely rather than shown as "0 ...".

export type ActionItem = {
  id: string;
  icon: "approval" | "interview" | "offer" | "document" | "eligible" | "company";
  count: number;
  title: string;
  subtitle: string;
  href: string;
};

// `db` is intentionally untyped (`any`) — this function is called with the
// tenant-scoped client, and unifying the tenant-scoped/raw/transaction
// Prisma client types blows up TypeScript's comparison stack in this
// codebase, the same issue documented in lib/applications.ts and
// lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActionItems(db: any, collegeId: string, batchId: string | null = null): Promise<ActionItem[]> {
  const studentBatchWhere = batchId ? { student: { batchId } } : {};

  const [
    appliedCount,
    appliedDrives,
    assignedInterviewCount,
    issuedOfferCount,
    missingResumeCount,
    eligibleNoAppCount,
    pendingPartnershipCount,
  ] = await Promise.all([
    // 1. Applications waiting for approval.
    db.application.count({ where: { status: "APPLIED", ...studentBatchWhere } }),
    db.application.findMany({
      where: { status: "APPLIED", ...studentBatchWhere },
      select: { driveId: true },
      distinct: ["driveId"],
    }),
    // 2. Interviews assigned to a round but not yet scheduled.
    db.roundCandidate.count({ where: { status: "ASSIGNED", ...studentBatchWhere } }),
    // 3. Offers issued but not yet accepted/declined.
    db.offer.count({ where: { status: "ISSUED", ...studentBatchWhere } }),
    // 4. Students with no default resume set.
    db.student.count({ where: { resumes: { none: { isDefault: true } }, ...(batchId ? { batchId } : {}) } }),
    // 5. Eligible students who have never applied to anything.
    db.student.count({
      where: { eligibleForPlacements: true, applications: { none: {} }, ...(batchId ? { batchId } : {}) },
    }),
    // 6. Company partnerships still pending confirmation — not batch-scoped,
    // a partnership is a college-company relationship independent of batch.
    db.collegePartnership.count({ where: { status: "PENDING" } }),
  ]);

  const items: ActionItem[] = [];

  if (appliedCount > 0) {
    items.push({
      id: "applications-pending-approval",
      icon: "approval",
      count: appliedCount,
      title: `${appliedCount} Applications waiting for approval`,
      subtitle: `Across ${appliedDrives.length} drive${appliedDrives.length === 1 ? "" : "s"}`,
      href: "/applications?tab=applied",
    });
  }

  if (assignedInterviewCount > 0) {
    items.push({
      id: "interviews-need-scheduling",
      icon: "interview",
      count: assignedInterviewCount,
      title: `${assignedInterviewCount} Interviews need scheduling`,
      subtitle: "Awaiting scheduling",
      href: "/interviews?tab=needs-scheduling",
    });
  }

  if (issuedOfferCount > 0) {
    items.push({
      id: "offers-awaiting-response",
      icon: "offer",
      count: issuedOfferCount,
      title: `${issuedOfferCount} Offers awaiting response`,
      subtitle: "Issued, not yet accepted or declined",
      href: "/offers?tab=issued",
    });
  }

  if (missingResumeCount > 0) {
    items.push({
      id: "students-incomplete-documents",
      icon: "document",
      count: missingResumeCount,
      title: `${missingResumeCount} Students with incomplete documents`,
      subtitle: "No resume uploaded",
      href: "/students?missingResume=1",
    });
  }

  if (eligibleNoAppCount > 0) {
    items.push({
      id: "eligible-students-not-applied",
      icon: "eligible",
      count: eligibleNoAppCount,
      title: `${eligibleNoAppCount} Eligible students haven't applied`,
      subtitle: "Across active drives",
      href: "/students?notApplied=1",
    });
  }

  if (pendingPartnershipCount > 0) {
    items.push({
      id: "companies-awaiting-confirmation",
      icon: "company",
      count: pendingPartnershipCount,
      title: `${pendingPartnershipCount} Companies awaiting confirmation`,
      subtitle: "Partnership pending",
      href: "/companies?tab=prospects",
    });
  }

  return items;
}
