import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getCompanyTalentSkillInsights } from "@/lib/companies/skill-insights";

// A real, assessment-backed pitch a TPO can show this recruiting company —
// this is the one place placement CRM data (who's eligible for them) and
// assessment-engine data (real test scores, synced from the separate
// ~/placement-erp-assessments app) come together. Deliberately honest
// about sample size: below a minimum number of eligible students with
// real assessment history, this says so instead of showing a noisy
// percentage that would look precise but isn't trustworthy at that size.
export async function TalentInsightsTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { preferredCourseIds: true, minCgpaPreference: true, backlogPolicy: true },
  });
  if (!company) return null;

  const insights = await getCompanyTalentSkillInsights(db, company);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Talent pool — assessment performance</CardTitle>
          <CardDescription>
            Real scores from this college&apos;s assessment platform, across the {insights.eligibleCount} student
            {insights.eligibleCount === 1 ? "" : "s"} currently eligible for {"this company's"} preferences — not
            self-reported skills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!insights.confident ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Only {insights.assessedCount} eligible student{insights.assessedCount === 1 ? "" : "s"} {insights.assessedCount === 1 ? "has" : "have"} taken a
              real assessment so far — not enough to show a reliable average yet. Check back once more students have
              attempted a test.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground text-xs">Assessed students</div>
                <div className="text-xl font-bold tabular-nums">
                  {insights.assessedCount} / {insights.eligibleCount}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Average score</div>
                <div className="text-xl font-bold tabular-nums">{insights.avgScorePercent}%</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Scored {insights.strongThresholdPercent}%+</div>
                <div className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {insights.strongPercent}%
                </div>
              </div>
            </div>
          )}
          {insights.confidentCoding && (
            <div className="mt-4 border-t pt-3 text-sm">
              <div className="text-muted-foreground text-xs">
                Average coding-question pass rate ({insights.codingAssessedCount} student{insights.codingAssessedCount === 1 ? "" : "s"} with a
                coding submission)
              </div>
              <div className="font-semibold tabular-nums">{insights.avgCodingPassPercent}%</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
