import "server-only";
import { prisma } from "@/lib/db";
import { getCompanyHiringActivity } from "@/lib/contacts/stats";
import { getCompanyFunnel, getCompanyPackageAnalytics, getCompanyNextFollowUp, getCompanyLastActivityAt } from "@/lib/companies/stats";
import { computeCompanyHealthScore } from "@/lib/companies/health-score";

// A compact, factual snapshot of one company — handed to the AI as the ONLY
// source of truth for the Company 360 AI-insight feature, mirroring
// buildContactContext's contract: summary-level real data, never invented.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildCompanyContext(db: any, companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const partnership = await db.collegePartnership.findFirst({ where: { companyId } });

  const [hiringActivity, funnel, packageStats, nextFollowUp, lastActivityAt] = await Promise.all([
    getCompanyHiringActivity(db, companyId),
    getCompanyFunnel(db, companyId),
    getCompanyPackageAnalytics(db, companyId),
    getCompanyNextFollowUp(db, companyId),
    getCompanyLastActivityAt(db, companyId),
  ]);

  const health = computeCompanyHealthScore({
    lastActivityAt,
    activeDriveCount: hiringActivity.activeDrives,
    studentsHiredLast12Months: hiringActivity.studentsHired,
    nextFollowUpAt: nextFollowUp?.nextFollowUpAt ?? null,
  });

  const now = new Date();
  const daysSinceActivity = lastActivityAt ? Math.round((now.getTime() - new Date(lastActivityAt).getTime()) / 86400000) : null;
  const followUpDays = nextFollowUp?.nextFollowUpAt ? Math.round((new Date(nextFollowUp.nextFollowUpAt).getTime() - now.getTime()) / 86400000) : null;

  const lines = [
    `Company: ${company.name}`,
    `Industry: ${company.industryType ?? "Not set"}`,
    `Partnership status: ${partnership?.status ?? "Not set"}`,
    `Company type: ${company.companyType ?? "Not set"}`,
    `Partner health score: ${health.score}/100 (${health.label}) — computed from recency of activity, active drives, students hired in the last 12 months, and follow-up status`,
    `Days since last recorded activity: ${daysSinceActivity ?? "no activity logged yet"}`,
    `Next follow-up: ${
      nextFollowUp?.nextFollowUpAt
        ? `${new Date(nextFollowUp.nextFollowUpAt).toLocaleDateString("en-IN")} (${followUpDays !== null && followUpDays < 0 ? `${Math.abs(followUpDays)} days overdue` : `in ${followUpDays} days`})${nextFollowUp.nextFollowUpNote ? ` — note: ${nextFollowUp.nextFollowUpNote}` : ""}`
        : "none scheduled"
    }`,
    `Active drives: ${hiringActivity.activeDrives}`,
    `Completed drives: ${hiringActivity.completedDrives}`,
    `Students hired (all time): ${hiringActivity.studentsHired}`,
    `Offers made (all time): ${hiringActivity.offersMade}`,
    `Placement funnel (all time): ${funnel.applications} applications, ${funnel.shortlisted} shortlisted, ${funnel.interviewed} interviewed, ${funnel.selected} selected, ${funnel.offers} offers, ${funnel.joined} joined`,
    `Offer rate: ${funnel.offerRate}% · Joining rate: ${funnel.joiningRate}%`,
    `Compensation (accepted/joined offers): ${
      packageStats.count > 0
        ? `min ₹${(packageStats.minCtc! / 100000).toFixed(1)}L, max ₹${(packageStats.maxCtc! / 100000).toFixed(1)}L, avg ₹${(packageStats.avgCtc! / 100000).toFixed(1)}L, median ₹${(packageStats.medianCtc! / 100000).toFixed(1)}L across ${packageStats.count} offers`
        : "no compensation data yet"
    }`,
  ];

  return lines.join("\n");
}
