// Conservative fresher/entry-level keyword filter for the external-jobs
// pipeline (see scripts/sync-external-jobs.ts). Deliberately biased toward
// FALSE NEGATIVES over FALSE POSITIVES: missing a real fresher opening is
// a minor loss (the TPO's own drives are still the primary channel), but
// mislabeling a senior role as "fresher-relevant" and having a TPO approve
// it by mistake is the actual trust risk this whole feature is designed to
// avoid. A posting only becomes a review candidate if it matches at least
// one ALLOW signal and matches NO DENY signal — the deny list always wins.

const ALLOW_KEYWORDS = [
  "entry level",
  "entry-level",
  "fresher",
  "freshers",
  "graduate",
  "new grad",
  "new-grad",
  "campus hire",
  "campus recruit",
  "trainee",
  "associate",
  "early career",
  "junior",
  "intern to hire",
  "intern-to-hire",
  "0-1 year",
  "0-2 year",
  "0 to 1 year",
  "0 to 2 year",
  "no experience required",
];

const DENY_KEYWORDS = [
  "senior",
  "sr.",
  "sr ", // "Sr Consultant", "Sr Manager" — same abbreviation as "sr." but without the period; a real posting ("Microsoft: Sr Consultant - Infra") slipped through the filter with just "sr." checked
  "staff ", // "Staff Software Engineer", "Staff Product Manager" — a level above Senior in most tech ladders
  "principal",
  "lead ",
  "team lead",
  "manager",
  "director",
  "head of",
  " head", // "Operations Head", "City Operations Head" — "head of" alone missed the equally common suffix form; a real posting slipped through the same way as "sr "
  "vp ",
  "vice president",
  "chief ",
  "architect",
  "partner",
  "5+ year",
  "6+ year",
  "7+ year",
  "8+ year",
  "9+ year",
  "10+ year",
  "5 - year",
  "minimum 5 year",
  "minimum 7 year",
];

// "PhD" alone is a deny-ish signal (research roles are rarely campus-fresher
// hiring) UNLESS the posting itself frames it as early-career (Google's
// real "Software Engineer, PhD, Early Career" postings are a real example
// that should NOT be excluded just because "PhD" is in the title).
const PHD_ALLOW_PAIRING = ["early career", "new grad", "entry level", "entry-level"];

export type FilterResult = { matched: true; matchedKeywords: string[] } | { matched: false; matchedKeywords: [] };

export function classifyFresherJob(title: string, description: string): FilterResult {
  const titleLower = title.toLowerCase();
  const haystack = `${title} ${description}`.toLowerCase();

  const hasPhd = titleLower.includes("phd");
  const phdIsAllowed = !hasPhd || PHD_ALLOW_PAIRING.some((p) => titleLower.includes(p));
  if (hasPhd && !phdIsAllowed) {
    return { matched: false, matchedKeywords: [] };
  }

  // Deny-keywords are checked against the TITLE only, not the full
  // description — real seniority signals live in the title ("Senior X",
  // "X Director"), while descriptions are dominated by boilerplate that's
  // identical across a company's entire posting catalog (equity-grant
  // text, EEO/legal disclaimers) and routinely contains phrases like
  // "board of directors" or "reports to the head of engineering" that have
  // nothing to do with THIS role's seniority. Checking those against the
  // description was silently rejecting real entry-level postings (e.g.
  // every Google posting mentions "Alphabet's board of directors" in its
  // equity boilerplate) for the wrong reason.
  const deniedBy = DENY_KEYWORDS.find((kw) => titleLower.includes(kw));
  if (deniedBy) {
    return { matched: false, matchedKeywords: [] };
  }

  const matchedKeywords = ALLOW_KEYWORDS.filter((kw) => haystack.includes(kw));
  if (matchedKeywords.length === 0) {
    return { matched: false, matchedKeywords: [] };
  }

  return { matched: true, matchedKeywords };
}
