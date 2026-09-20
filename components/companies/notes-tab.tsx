import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { CompanyNotesPanel } from "@/components/companies/company-notes-panel";

// Server-side data fetch + permission check for the Notes tab; the compose
// form and list live in the client CompanyNotesPanel, mirroring the split
// used by DocumentsTab and by contacts' ContactNotesPanel.
export async function NotesTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [notes, canEdit] = await Promise.all([
    db.companyNote.findMany({
      where: { companyId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    hasPermission(session, "company.edit"),
  ]);

  type NoteRow = { id: string; body: string; createdAt: Date; author: { name: string } };

  return (
    <CompanyNotesPanel
      companyId={companyId}
      canEdit={canEdit}
      notes={notes.map((n: NoteRow) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        author: { name: n.author.name },
      }))}
    />
  );
}
