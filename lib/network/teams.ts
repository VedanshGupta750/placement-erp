// "Teams" (Placement Coordinators, Department Placement Coordinators, etc.)
// are real DepartmentMembership rows grouped by title — the exact
// designation data placement staff already have, not a separate model.
export type NetworkTeam = { key: string; label: string; members: { id: string; name: string; departmentName: string; designation: string }[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTeams(db: any): Promise<NetworkTeam[]> {
  const memberships = await db.departmentMembership.findMany({
    include: { user: { select: { id: true, name: true } }, department: { select: { name: true } } },
    orderBy: { title: "asc" },
  });

  const byTitle = new Map<string, NetworkTeam>();
  for (const m of memberships as { title: string; designation: string; user: { id: string; name: string }; department: { name: string } }[]) {
    if (!byTitle.has(m.title)) byTitle.set(m.title, { key: m.title, label: m.title, members: [] });
    byTitle.get(m.title)!.members.push({ id: m.user.id, name: m.user.name, departmentName: m.department.name, designation: m.designation });
  }
  return [...byTitle.values()].sort((a, b) => b.members.length - a.members.length);
}
