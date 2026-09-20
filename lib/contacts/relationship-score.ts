// A system-generated indicator, not a fact — always label it as such in the
// UI. Computed purely from real, queryable signals (no fabricated inputs):
// recency of the last logged communication, the contact's company's active
// drives, real hiring history (offers issued at that company), and whether
// the next follow-up is set/overdue. 0-100, weighted 30/30/25/15.
export type RelationshipScore = {
  score: number;
  label: "Strong" | "Moderate" | "Needs Attention";
};

export function computeRelationshipScore(input: {
  lastCommunicationAt: Date | null;
  activeDriveCount: number;
  studentsHiredCount: number;
  nextFollowUpAt: Date | null;
}): RelationshipScore {
  const now = Date.now();

  let recencyPoints = 0;
  if (input.lastCommunicationAt) {
    const days = (now - input.lastCommunicationAt.getTime()) / 86_400_000;
    if (days <= 7) recencyPoints = 30;
    else if (days <= 30) recencyPoints = 20;
    else if (days <= 90) recencyPoints = 10;
  }

  const drivePoints = Math.min(input.activeDriveCount * 10, 30);
  const hiringPoints = Math.min(input.studentsHiredCount * 2, 25);

  let followUpPoints = 8; // neutral — no follow-up scheduled either way
  if (input.nextFollowUpAt) {
    followUpPoints = input.nextFollowUpAt.getTime() >= now ? 15 : 0;
  }

  const score = Math.round(recencyPoints + drivePoints + hiringPoints + followUpPoints);
  const label = score >= 70 ? "Strong" : score >= 40 ? "Moderate" : "Needs Attention";
  return { score, label };
}
