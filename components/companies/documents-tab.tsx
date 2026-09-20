import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { CompanyDocumentsPanel, type CompanyDocumentCategory } from "@/components/companies/company-documents-panel";

// Server-side data fetch + permission check for the Documents tab; the
// actual upload/list/delete UI lives in the client CompanyDocumentsPanel,
// mirroring components/contacts/contact-documents-panel.tsx's split.
export async function DocumentsTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [documents, canEdit] = await Promise.all([
    db.companyDocument.findMany({
      where: { companyId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    hasPermission(session, "company.edit"),
  ]);

  type DocumentRow = {
    id: string;
    fileName: string;
    category: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
    createdAt: Date;
    uploadedBy: { name: string } | null;
  };

  return (
    <CompanyDocumentsPanel
      companyId={companyId}
      canEdit={canEdit}
      documents={documents.map((d: DocumentRow) => ({
        id: d.id,
        fileName: d.fileName,
        category: d.category as CompanyDocumentCategory,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        dataUrl: d.dataUrl,
        createdAt: d.createdAt.toISOString(),
        uploadedBy: d.uploadedBy,
      }))}
    />
  );
}
