import "server-only";
import { generateJSON } from "@/lib/ai/client";

export type DetectedRequest = {
  isRecruitmentRequest: boolean;
  summary: string;
  courseKeywords: string[];
  minCgpa: number | null;
  count: number | null;
};

// Cheap keyword pre-filter so we don't spend an API call (or a stub round
// trip) on every message in a thread — only messages that look like an ask
// get sent to the model.
const REQUEST_HINTS = [
  "share",
  "send",
  "profile",
  "resume",
  "cv",
  "candidate",
  "student",
  "shortlist",
  "cgpa",
  "need",
  "require",
  "looking for",
  "schedule",
  "interview",
];

export function looksLikeRequest(body: string) {
  const lower = body.toLowerCase();
  return REQUEST_HINTS.some((hint) => lower.includes(hint));
}

// Extracts a structured recruitment ask ("send 20 CSE students above 8 CGPA")
// from a free-text message so the TPO can act on it without re-typing the
// criteria into the student search. Falls back to a keyword-derived stub when
// no AI key is configured, same contract as every other AI feature here.
export async function detectRecruitmentRequest(body: string): Promise<{ data: DetectedRequest; stub: boolean }> {
  return generateJSON<DetectedRequest>({
    system:
      "You read a single message sent to a college placement cell and decide whether it is a concrete recruitment request — an ask for candidate profiles, a shortlist, or interview scheduling. Return JSON with: isRecruitmentRequest (boolean), summary (one short sentence describing what is being asked for, plain text), courseKeywords (array of degree/branch names or abbreviations mentioned, e.g. [\"CSE\"], empty if none), minCgpa (number or null), count (how many candidates are asked for, number or null). Never invent criteria that aren't in the message — use null/empty rather than guessing.",
    prompt: body,
    stubFallback: () => {
      const lower = body.toLowerCase();
      const cgpaMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:\+|above|or above|and above)?\s*cgpa|cgpa\s*(?:above|over|>=?|of)?\s*(\d+(?:\.\d+)?)/);
      const countMatch = lower.match(/\b(\d{1,3})\s+(?:students?|candidates?|profiles?)\b/);
      const branches = ["cse", "it", "ece", "eee", "mechanical", "civil", "mba", "mca"].filter((b) => lower.includes(b));
      return {
        isRecruitmentRequest: looksLikeRequest(body),
        summary: body.slice(0, 120),
        courseKeywords: branches.map((b) => b.toUpperCase()),
        minCgpa: cgpaMatch ? Number(cgpaMatch[1] ?? cgpaMatch[2]) : null,
        count: countMatch ? Number(countMatch[1]) : null,
      };
    },
  });
}

// Turns a detected request into a /students query string so "Find candidates"
// lands on the real, already-built student list with the filters applied
// rather than a bespoke half-search.
//
// Branch keywords are resolved to a real Course id by the caller — the
// students list filters by courseId, and its free-text `q` only matches
// student names/enrollment numbers, so passing "CSE" as `q` would silently
// return nothing. If no course matches, we simply don't apply that filter
// (and the UI says which criteria it could and couldn't apply).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildCandidateSearch(db: any, req: DetectedRequest) {
  const params = new URLSearchParams();
  if (req.minCgpa != null) params.set("minCgpa", String(req.minCgpa));

  let matchedCourseName: string | null = null;
  if (req.courseKeywords.length > 0) {
    const course = await db.course.findFirst({
      where: {
        OR: req.courseKeywords.flatMap((k: string) => [
          { name: { contains: k, mode: "insensitive" } },
          { specialization: { contains: k, mode: "insensitive" } },
        ]),
      },
      select: { id: true, name: true, specialization: true },
    });
    if (course) {
      params.set("courseId", course.id);
      matchedCourseName = course.specialization ?? course.name;
    }
  }

  const qs = params.toString();
  return {
    href: qs ? `/students?${qs}` : "/students",
    matchedCourseName,
    unmatchedCourseKeywords: matchedCourseName ? [] : req.courseKeywords,
  };
}
