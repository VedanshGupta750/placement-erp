// Lightweight fuzzy match for the Add Company duplicate-detection warning —
// deliberately simple (normalize + substring match), not a fuzzy-distance
// algorithm. Good enough to catch "TCS" vs "Tata Consultancy Services"-style
// near-duplicates isn't the goal here; catching exact-modulo-punctuation
// duplicates ("Siemens" vs "Siemens Ltd.") is.
const SUFFIX_WORDS = new Set(["ltd", "limited", "pvt", "private", "inc", "incorporated", "llc", "corp", "corporation", "co"]);

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter((w) => w && !SUFFIX_WORDS.has(w))
    .join(" ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findPossibleDuplicateCompany(prismaClient: any, name: string): Promise<{ id: string; name: string } | null> {
  const normalized = normalizeCompanyName(name);
  if (!normalized) return null;

  const candidates: { id: string; name: string }[] = await prismaClient.company.findMany({
    where: { name: { contains: normalized.split(" ")[0], mode: "insensitive" } },
    select: { id: true, name: true },
    take: 25,
  });

  const match = candidates.find((c) => normalizeCompanyName(c.name) === normalized);
  return match ?? null;
}
