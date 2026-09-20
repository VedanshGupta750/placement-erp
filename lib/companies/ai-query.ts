import "server-only";
import type { TenantDb } from "@/lib/tenant/scoped-db";
import { generateJSON } from "@/lib/ai/client";
import { getCompanyHiringActivity } from "@/lib/contacts/stats";
import { getCompanyFunnel } from "@/lib/companies/stats";

type ExtractedCriteria = {
  industryType: string | null;
  minStudentsHiredLastYear: number | null;
  hasNoDriveThisYear: boolean | null;
  minJoiningRate: number | null;
  minOfferRate: number | null;
  status: "PENDING" | "ACTIVE" | "PARTNER" | "DORMANT" | "BLOCKED" | null;
  sortBy: "studentsHiredLastYear" | "joiningRate" | "offerRate" | "offers" | "applications" | null;
  sortDescending: boolean;
  unmatchable: string[];
};

// Natural-language filter/rank query over this college's partner companies
// — "companies that hired 10+ students last year but haven't opened a
// drive this season", "highest joining rate companies". Same contract as
// lib/students/ai-query.ts: never a bulk action itself, only ever produces
// a list for the TPO to review; every number shown is a real computed
// aggregate (getCompanyHiringActivity/getCompanyFunnel), never invented by
// the model.
export async function runCompanyAiQuery(db: TenantDb, query: string) {
  const partnerships = await db.collegePartnership.findMany({
    include: { company: { select: { id: true, name: true, industryType: true } } },
  });

  const industries = [...new Set(partnerships.map((p) => p.company.industryType).filter(Boolean))].join(", ") || "(none set)";

  const { data: criteria, stub } = await generateJSON<ExtractedCriteria>({
    system:
      "You extract structured search/rank criteria from a TPO's natural-language question about partner companies at a campus placement cell. " +
      "Return ONLY fields you're confident about from the text — null for anything not mentioned. " +
      `This college's real company industries are: ${industries}. ` +
      "industryType matches as a case-insensitive substring against that real list — pick a substring that actually occurs there. " +
      "minStudentsHiredLastYear/minJoiningRate/minOfferRate are numeric thresholds (rate values are 0-100, a percentage). " +
      "hasNoDriveThisYear is true only if the question explicitly contrasts past hiring with no current-season activity (e.g. 'but hasn't opened a drive this year/season'). " +
      "status is ONLY ever one of PENDING, ACTIVE, PARTNER, DORMANT, BLOCKED, or null — never invent another value. " +
      "sortBy/sortDescending capture ranking language like 'highest joining rate' (sortBy=joiningRate, sortDescending=true) or 'fewest offers' (sortBy=offers, sortDescending=false). " +
      "unmatchable lists any part of the question you could NOT map to a field here — be honest, don't silently drop things.",
    prompt: `Question: "${query}"\n\nRespond as JSON: {industryType, minStudentsHiredLastYear, hasNoDriveThisYear, minJoiningRate, minOfferRate, status, sortBy, sortDescending, unmatchable}`,
    stubFallback: () => ({
      industryType: null,
      minStudentsHiredLastYear: null,
      hasNoDriveThisYear: null,
      minJoiningRate: null,
      minOfferRate: null,
      status: null,
      sortBy: null,
      sortDescending: true,
      unmatchable: ["AI generation isn't configured (no ANTHROPIC_API_KEY/OPENAI_API_KEY set) — showing all partner companies unfiltered instead."],
    }),
  });

  const VALID_STATUSES = new Set(["PENDING", "ACTIVE", "PARTNER", "DORMANT", "BLOCKED"]);
  if (criteria.status && !VALID_STATUSES.has(criteria.status)) {
    criteria.unmatchable = [...criteria.unmatchable, `Ignored an unrecognized status the AI returned: "${criteria.status}".`];
    criteria.status = null;
  }
  const VALID_SORT_KEYS = new Set(["studentsHiredLastYear", "joiningRate", "offerRate", "offers", "applications"]);
  if (criteria.sortBy && !VALID_SORT_KEYS.has(criteria.sortBy)) {
    criteria.sortBy = null;
  }

  let candidates = criteria.industryType
    ? partnerships.filter((p) => (p.company.industryType ?? "").toLowerCase().includes(criteria.industryType!.toLowerCase()))
    : partnerships;
  if (criteria.status) candidates = candidates.filter((p) => p.status === criteria.status);

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const enriched = await Promise.all(
    candidates.map(async (p) => {
      const [hiringActivity, funnel, driveThisYear] = await Promise.all([
        getCompanyHiringActivity(db, p.company.id),
        getCompanyFunnel(db, p.company.id),
        db.drive.findFirst({ where: { companyId: p.company.id, createdAt: { gte: new Date(`${currentYear}-01-01`) } }, select: { id: true } }),
      ]);
      const studentsHiredLastYear = hiringActivity.hiringHistory.find((h: { year: number }) => h.year === lastYear)?.studentsHired ?? 0;
      return {
        id: p.company.id,
        name: p.company.name,
        industryType: p.company.industryType,
        status: p.status,
        studentsHiredLastYear,
        hasDriveThisYear: !!driveThisYear,
        offers: funnel.offers,
        applications: funnel.applications,
        joiningRate: funnel.joiningRate,
        offerRate: funnel.offerRate,
      };
    }),
  );

  let matched = enriched;
  if (criteria.minStudentsHiredLastYear != null) matched = matched.filter((c) => c.studentsHiredLastYear >= criteria.minStudentsHiredLastYear!);
  if (criteria.hasNoDriveThisYear) matched = matched.filter((c) => !c.hasDriveThisYear);
  if (criteria.minJoiningRate != null) matched = matched.filter((c) => c.joiningRate >= criteria.minJoiningRate!);
  if (criteria.minOfferRate != null) matched = matched.filter((c) => c.offerRate >= criteria.minOfferRate!);

  if (criteria.sortBy) {
    const key = criteria.sortBy;
    matched = [...matched].sort((a, b) => (criteria.sortDescending ? b[key] - a[key] : a[key] - b[key]));
  }

  return {
    stub,
    matchedIds: matched.map((c) => c.id),
    companies: matched.slice(0, 200),
    unmatched: criteria.unmatchable,
    interpreted: {
      industry: criteria.industryType,
      status: criteria.status,
      minStudentsHiredLastYear: criteria.minStudentsHiredLastYear,
      hasNoDriveThisYear: criteria.hasNoDriveThisYear,
      minJoiningRate: criteria.minJoiningRate,
      minOfferRate: criteria.minOfferRate,
      sortedBy: criteria.sortBy,
    },
  };
}
