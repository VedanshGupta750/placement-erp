import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";

// Offer.offerLetterFileId has existed in the schema since the Offer model
// was first built but nothing ever set it — this is the first real upload
// path for it, now that File.dataUrl exists (see the Applications-round
// file-storage fix).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "offer.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const offer = await db.offer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }

  const uploaded = await readFileAsDataUri(file);
  if (!uploaded.ok) {
    return NextResponse.json({ error: "validation_error", message: uploaded.message }, { status: 400 });
  }

  const fileRow = await db.file.create({
    data: {
      collegeId: session.collegeId,
      storageKey: `local/offer-letter-${id}`,
      dataUrl: uploaded.dataUri,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      visibility: "PRIVATE",
      uploadedById: session.userId,
    },
  });

  await db.offer.update({ where: { id }, data: { offerLetterFileId: fileRow.id } });

  return NextResponse.json({ ok: true });
}
