// Real skill-gap analysis: skills required by currently active drives that
// too few students on the eligible side actually have. No invented
// "predicted future skill demand" — just a live comparison of two real
// sets (drive-required skills vs student-held skills).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSkillGaps(db: any, limit = 6, batchId: string | null = null) {
  const [requiredSkills, studentSkillCounts, studentCount] = await Promise.all([
    db.driveSkill.findMany({
      where: { drive: { status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "SELECTION_ONGOING"] }, ...(batchId ? { batchId } : {}) } },
      select: { skillId: true, skill: { select: { name: true } } },
    }),
    db.studentSkill.groupBy({ by: ["skillId"], _count: { _all: true }, where: batchId ? { student: { batchId } } : {} }),
    db.student.count({ where: batchId ? { batchId } : {} }),
  ]);

  const demandCount = new Map<string, { name: string; demand: number }>();
  for (const r of requiredSkills as { skillId: string; skill: { name: string } }[]) {
    const entry = demandCount.get(r.skillId) ?? { name: r.skill.name, demand: 0 };
    entry.demand += 1;
    demandCount.set(r.skillId, entry);
  }
  const haveCount = new Map(studentSkillCounts.map((s: { skillId: string; _count: { _all: number } }) => [s.skillId, s._count._all]));

  const gaps = [...demandCount.entries()]
    .map(([skillId, v]) => {
      const have = (haveCount.get(skillId) as number | undefined) ?? 0;
      const coveragePct = studentCount > 0 ? Math.round((have / studentCount) * 1000) / 10 : 0;
      return { skillId, name: v.name, drivesRequiring: v.demand, studentsWithSkill: have, coveragePct };
    })
    .filter((g) => g.coveragePct < 30) // real threshold — "gap" means under-covered, not zero
    .sort((a, b) => b.drivesRequiring - a.drivesRequiring)
    .slice(0, limit);

  return gaps;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActivelyHiringCompanies(db: any, limit = 6, batchId: string | null = null) {
  const activeDriveWhere = { status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "SELECTION_ONGOING"] }, ...(batchId ? { batchId } : {}) };
  const companies = await db.company.findMany({
    where: { drives: { some: activeDriveWhere } },
    select: {
      id: true,
      name: true,
      drives: { where: activeDriveWhere, select: { id: true, _count: { select: { applications: true } } } },
    },
    take: limit * 2,
  });

  return companies
    .map((c: { id: string; name: string; drives: { id: string; _count: { applications: number } }[] }) => ({
      id: c.id,
      name: c.name,
      activeDrives: c.drives.length,
      totalApplicants: c.drives.reduce((s, d) => s + d._count.applications, 0),
    }))
    .sort((a: { activeDrives: number }, b: { activeDrives: number }) => b.activeDrives - a.activeDrives)
    .slice(0, limit);
}
