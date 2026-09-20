import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: contactId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }

  const result = await readFileAsDataUri(file);
  if (!result.ok) {
    return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
  }

  const document = await db.contactDocument.create({
    data: {
      contactId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl: result.dataUri,
      uploadedById: session.userId,
    },
  });

  return NextResponse.json({ ok: true, id: document.id });
}
