// Company-level counterpart to lib/contacts/relationship-score.ts — same
// "system-generated indicator, not a fact" contract, always labelled as
// such in the UI. Computed purely from real, queryable signals: recency of
// any logged activity (communication/drive/event), active drives, hiring
// in the last 12 months, and follow-up status across the company's
// recruiters.
export type CompanyHealthScore = {
  score: number;
  label: "Strong Partner" | "Moderate Partner" | "Needs Attention";
};

export function computeCompanyHealthScore(input: {
  lastActivityAt: Date | null;
  activeDriveCount: number;
  studentsHiredLast12Months: number;
  nextFollowUpAt: Date | null;
}): CompanyHealthScore {
  const now = Date.now();

  let recencyPoints = 0;
  if (input.lastActivityAt) {
    const days = (now - input.lastActivityAt.getTime()) / 86_400_000;
    if (days <= 14) recencyPoints = 30;
    else if (days <= 45) recencyPoints = 20;
    else if (days <= 120) recencyPoints = 10;
  }

  const drivePoints = Math.min(input.activeDriveCount * 8, 25);
  const hiringPoints = Math.min(input.studentsHiredLast12Months * 3, 25);

  let followUpPoints = 10; // neutral — no follow-up scheduled either way
  if (input.nextFollowUpAt) {
    followUpPoints = input.nextFollowUpAt.getTime() >= now ? 20 : 0;
  }

  const score = Math.round(recencyPoints + drivePoints + hiringPoints + followUpPoints);
  const label = score >= 70 ? "Strong Partner" : score >= 40 ? "Moderate Partner" : "Needs Attention";
  return { score, label };
}
