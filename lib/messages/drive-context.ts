import "server-only";

// Live stats for the drive a conversation is linked to — every number is a
// real count against the tenant-scoped client, nothing estimated.
// `db` is intentionally untyped (`any`) — tenant-scoped client, see the
// convention documented in lib/applications.ts / lib/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConversationDriveContext(db: any, driveId: string) {
  const drive = await db.drive.findUnique({
    where: { id: driveId },
    select: { id: true, title: true, status: true, company: { select: { name: true } } },
  });
  if (!drive) return null;

  const [applications, shortlisted, offers, rounds] = await Promise.all([
    db.application.count({ where: { driveId } }),
    db.application.count({ where: { driveId, status: "SHORTLISTED" } }),
    db.offer.count({ where: { driveId } }),
    db.roundCandidate.count({ where: { round: { driveId } } }),
  ]);

  return {
    id: drive.id,
    title: drive.title,
    status: drive.status,
    companyName: drive.company?.name ?? null,
    applications,
    shortlisted,
    interviews: rounds,
    offers,
  };
}
