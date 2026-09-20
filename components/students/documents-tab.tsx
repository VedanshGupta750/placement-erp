import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentsManager } from "@/components/students/documents-manager";

export async function DocumentsTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [docs, canEdit] = await Promise.all([
    db.studentDocument.findMany({
      where: { studentId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    hasPermission(session, "student.edit"),
  ]);

  return (
    <Card>
      <CardContent className="pt-6">
        <DocumentsManager
          studentId={studentId}
          canEdit={canEdit}
          docs={docs.map((d: {
            id: string;
            fileName: string;
            dataUrl: string;
            category: string;
            sizeBytes: number;
            uploadedBy: { name: string } | null;
            verifiedAt: Date | null;
            createdAt: Date;
          }) => ({
            id: d.id,
            fileName: d.fileName,
            url: d.dataUrl,
            category: d.category,
            sizeBytes: d.sizeBytes,
            uploadedByName: d.uploadedBy?.name ?? null,
            verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
            createdAt: d.createdAt.toISOString(),
          }))}
        />
      </CardContent>
    </Card>
  );
}
