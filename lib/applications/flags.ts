// "Smart alerts" from the Applications spec — deliberately rule-based, not
// an LLM call: every flag below is a plain, explainable condition against
// real columns, so a TPO can trust it and never has to wonder whether an AI
// hallucinated a number. Sibling to lib/drives/health-signals.ts, which uses
// the same deterministic-rules-over-fake-AI-score approach.
const ACTIVE_STATUSES = ["COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS"];
const STALE_DAYS = 14;

export type ApplicationFlag = {
  applicationId: string;
  studentName: string;
  driveTitle: string;
  companyName: string;
  detail: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getApplicationFlags(db: any, where: Record<string, unknown> = {}) {
  const [stalledRaw, strongMatchRejectedRaw, shortlistedRaw] = await Promise.all([
    db.application.findMany({
      where: { ...where, status: { in: ACTIVE_STATUSES } },
      include: {
        student: { select: { user: { select: { name: true } } } },
        drive: { select: { title: true, company: { select: { name: true } } } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 500,
    }),
    db.application.findMany({
      where: { ...where, status: "REJECTED", matchScore: { gte: 70 } },
      include: {
        student: { select: { user: { select: { name: true } } } },
        drive: { select: { title: true, company: { select: { name: true } } } },
      },
      orderBy: { matchScore: "desc" },
      take: 20,
    }),
    db.application.findMany({
      where: { ...where, status: "SHORTLISTED" },
      include: {
        student: { select: { user: { select: { name: true } } } },
        drive: { select: { title: true, company: { select: { name: true } } } },
        roundCandidacies: { select: { id: true }, take: 1 },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 200,
    }),
  ]);

  type Row = {
    id: string;
    matchScore: number | null;
    appliedAt: Date;
    student: { user: { name: string } };
    drive: { title: string; company: { name: string } };
    statusHistory?: { createdAt: Date }[];
    roundCandidacies?: { id: string }[];
  };

  const stalled: ApplicationFlag[] = (stalledRaw as Row[])
    .map((a) => {
      const since = a.statusHistory?.[0]?.createdAt ?? a.appliedAt;
      const days = Math.floor((Date.now() - new Date(since).getTime()) / (24 * 60 * 60 * 1000));
      return { a, days };
    })
    .filter(({ days }) => days >= STALE_DAYS)
    .sort((x, y) => y.days - x.days)
    .slice(0, 20)
    .map(({ a, days }) => ({
      applicationId: a.id,
      studentName: a.student.user.name,
      driveTitle: a.drive.title,
      companyName: a.drive.company.name,
      detail: `No movement in ${days} days`,
    }));

  const strongMatchRejected: ApplicationFlag[] = (strongMatchRejectedRaw as Row[]).map((a) => ({
    applicationId: a.id,
    studentName: a.student.user.name,
    driveTitle: a.drive.title,
    companyName: a.drive.company.name,
    detail: `${a.matchScore}% skill match, rejected`,
  }));

  const shortlistedNoInterview: ApplicationFlag[] = (shortlistedRaw as Row[])
    .filter((a) => (a.roundCandidacies?.length ?? 0) === 0)
    .filter((a) => (a.statusHistory?.[0]?.createdAt ?? a.appliedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .map((a) => ({
      applicationId: a.id,
      studentName: a.student.user.name,
      driveTitle: a.drive.title,
      companyName: a.drive.company.name,
      detail: "Shortlisted 7+ days ago, no interview round assigned yet",
    }));

  return { stalled, strongMatchRejected, shortlistedNoInterview };
}
