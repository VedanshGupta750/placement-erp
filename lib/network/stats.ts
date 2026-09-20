// Real counts for the Network summary cards — deliberately no "Online now"
// card here (see components/network/person-card.tsx for why: no
// presence-tracking infra exists anywhere in this app).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNetworkStats(db: any) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [total, students, faculty, placementTeam, newThisMonth] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "ACTIVE", userType: "STUDENT" } }),
    db.user.count({ where: { status: "ACTIVE", userType: "FACULTY" } }),
    db.user.count({ where: { status: "ACTIVE", userType: "PLACEMENT_TEAM" } }),
    db.user.count({ where: { status: "ACTIVE", createdAt: { gte: monthStart } } }),
  ]);

  return { total, students, faculty, placementTeam, newThisMonth };
}
