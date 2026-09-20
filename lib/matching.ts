// Student <-> Drive skill-match scoring. Deliberately a plain overlap
// calculation today — no ANTHROPIC_API_KEY/OPENAI_API_KEY required — so the
// feature works out of the box. Swappable for a real embedding/LLM-based
// matcher later without touching the Application schema (matchScore,
// matchedSkills, missingSkills already live there as plain columns).
export function computeMatchScore(studentSkills: string[], requiredSkills: string[]) {
  if (requiredSkills.length === 0) {
    return { matchScore: null as number | null, matchedSkills: [] as string[], missingSkills: [] as string[] };
  }
  const studentSet = new Set(studentSkills.map((s) => s.toLowerCase().trim()));
  const matched = requiredSkills.filter((s) => studentSet.has(s.toLowerCase().trim()));
  const missing = requiredSkills.filter((s) => !studentSet.has(s.toLowerCase().trim()));
  const matchScore = Math.round((matched.length / requiredSkills.length) * 100);
  return { matchScore, matchedSkills: matched, missingSkills: missing };
}
