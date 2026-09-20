import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { CertificatesPanel } from "@/components/events/certificates-panel";
import { FilesManager } from "@/components/events/files-manager";

// Files tab — lists EventFile rows (upload/delete gated on event.edit) and,
// when the event has certificates enabled, the certificate-generation panel
// (gated on event.manage_registrations). Both pieces need client-side
// interactivity (upload progress, delete, generate) so the actual UI lives
// in two client components; this stays the single self-contained async
// server component the Event 360 page expects, fetching everything once and
// handing plain serializable props down.
export async function FilesTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, certificateEnabled: true } });
  if (!event) notFound();

  const [files, canEdit, canManageRegistrations] = await Promise.all([
    db.eventFile.findMany({
      where: { eventId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    hasPermission(session, "event.edit"),
    hasPermission(session, "event.manage_registrations"),
  ]);

  const showCertificates = event.certificateEnabled && canManageRegistrations;
  let certificates: { id: string; userId: string; userName: string; code: string; issuedAt: string }[] = [];
  let presentCount = 0;
  if (showCertificates) {
    const [certRows, present] = await Promise.all([
      db.eventCertificate.findMany({
        where: { eventId },
        include: { user: { select: { name: true } } },
        orderBy: { issuedAt: "desc" },
      }),
      db.eventAttendance.count({ where: { eventId, checkInAt: { not: null } } }),
    ]);
    certificates = certRows.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name,
      code: c.code,
      issuedAt: c.issuedAt.toISOString(),
    }));
    presentCount = present;
  }

  return (
    <div className="flex flex-col gap-6">
      {showCertificates && (
        <CertificatesPanel eventId={eventId} presentCount={presentCount} certificates={certificates} />
      )}

      <FilesManager
        eventId={eventId}
        canEdit={canEdit}
        files={files.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          category: f.category,
          uploadedByName: f.uploadedBy.name,
          createdAt: f.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
