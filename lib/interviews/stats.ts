// Real, computed numbers for the Interviews list page — sibling to
// lib/applications/stats.ts / lib/offers/stats.ts.
const DONE_STATUSES = ["PASSED", "FAILED", "NO_SHOW"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInterviewListStats(db: any, where: Record<string, unknown> = {}) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [needsScheduling, todayCandidates, inProgress, completed, scored] = await Promise.all([
    db.roundCandidate.count({ where: { ...where, status: "ASSIGNED" } }),
    db.roundCandidate.findMany({ where: { ...where, scheduledAt: { gte: todayStart, lte: todayEnd } }, select: { status: true } }),
    db.roundCandidate.count({ where: { ...where, status: "IN_PROGRESS" } }),
    db.roundCandidate.count({ where: { ...where, status: { in: DONE_STATUSES } } }),
    db.roundCandidate.findMany({ where: { ...where, status: { in: DONE_STATUSES }, score: { not: null } }, select: { score: true, status: true } }),
  ]);

  const today = {
    total: todayCandidates.length,
    upcoming: todayCandidates.filter((c: { status: string }) => ["SCHEDULED", "CHECKED_IN"].includes(c.status)).length,
    inProgress: todayCandidates.filter((c: { status: string }) => c.status === "IN_PROGRESS").length,
    completed: todayCandidates.filter((c: { status: string }) => DONE_STATUSES.includes(c.status)).length,
  };

  const passed = scored.filter((s: { status: string }) => s.status === "PASSED").length;
  const passRate = scored.length > 0 ? Math.round((passed / scored.length) * 1000) / 10 : null;
  const avgScore = scored.length > 0 ? Math.round((scored.reduce((sum: number, s: { score: number }) => sum + s.score, 0) / scored.length) * 10) / 10 : null;

  return { needsScheduling, today, inProgress, completed, passRate, avgScore };
}

// Applied -> Assessment -> Technical -> Managerial -> HR -> Selected, by
// real roundType groupBy — same "pipeline overview" shape the mockup wants,
// built from actual SelectionRound.roundType values rather than a fixed
// hardcoded list, since colleges name rounds differently.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInterviewPipelineBreakdown(db: any, where: Record<string, unknown> = {}) {
  const grouped = await db.roundCandidate.groupBy({
    where,
    by: ["roundId"],
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const rounds = await db.selectionRound.findMany({
    where: { id: { in: grouped.map((g: { roundId: string }) => g.roundId) } },
    select: { id: true, roundType: true },
  });
  const roundTypeById = new Map(rounds.map((r: { id: string; roundType: string }) => [r.id, r.roundType]));

  const byType = new Map<string, number>();
  for (const g of grouped as { roundId: string; _count: { _all: number } }[]) {
    const type = (roundTypeById.get(g.roundId) as string) ?? "Other";
    byType.set(type, (byType.get(type) ?? 0) + g._count._all);
  }
  const total = [...byType.values()].reduce((s, v) => s + v, 0);

  return [...byType.entries()]
    .map(([label, count]) => ({ label, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);
}

// Interviewer performance — name-string grouped, since interviewerName
// isn't a real User relation (see lib/interviews/conflicts.ts for the same
// caveat). Gated on a stricter permission at the call site since this is
// individual staff performance data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInterviewerStats(db: any, where: Record<string, unknown> = {}) {
  const candidates = await db.roundCandidate.findMany({
    where: { ...where, interviewerName: { not: null } },
    select: { interviewerName: true, status: true, score: true },
  });
  const byInterviewer = new Map<string, { total: number; passed: number; scored: number[]; }>();
  for (const c of candidates as { interviewerName: string; status: string; score: number | null }[]) {
    const entry = byInterviewer.get(c.interviewerName) ?? { total: 0, passed: 0, scored: [] };
    entry.total += 1;
    if (c.status === "PASSED") entry.passed += 1;
    if (c.score !== null && DONE_STATUSES.includes(c.status)) entry.scored.push(c.score);
    byInterviewer.set(c.interviewerName, entry);
  }
  return [...byInterviewer.entries()]
    .map(([name, e]) => ({
      name,
      total: e.total,
      passRate: e.scored.length > 0 ? Math.round((e.passed / e.scored.length) * 1000) / 10 : null,
      avgScore: e.scored.length > 0 ? Math.round((e.scored.reduce((s, v) => s + v, 0) / e.scored.length) * 10) / 10 : null,
    }))
    .sort((a, b) => b.total - a.total);
}
