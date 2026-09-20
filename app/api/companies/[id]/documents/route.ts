import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";
import { recordAudit } from "@/lib/audit";
import type { CompanyDocumentCategory } from "@/lib/generated/prisma/client";

const VALID_CATEGORIES = new Set<CompanyDocumentCategory>([
  "MOU",
  "NDA",
  "JOB_DESCRIPTION",
  "OFFER_TEMPLATE",
  "BROCHURE",
  "HIRING_POLICY",
  "SALARY_STRUCTURE",
  "OTHER",
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: companyId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const partnership = await db.collegePartnership.findFirst({ where: { companyId } });
  if (!partnership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }

  const categoryRaw = formData.get("category");
  const category: CompanyDocumentCategory =
    typeof categoryRaw === "string" && VALID_CATEGORIES.has(categoryRaw as CompanyDocumentCategory)
      ? (categoryRaw as CompanyDocumentCategory)
      : "OTHER";

  const result = await readFileAsDataUri(file);
  if (!result.ok) {
    return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
  }

  const doc = await db.companyDocument.create({
    data: {
      collegeId: session.collegeId,
      companyId,
      category,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl: result.dataUri,
      uploadedById: session.userId,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.document_uploaded",
    resourceType: "Company",
    resourceId: companyId,
    after: { fileName: file.name, category },
  });

  return NextResponse.json({ ok: true, id: doc.id });
}
