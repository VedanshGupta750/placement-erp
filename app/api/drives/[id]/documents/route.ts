import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drive = await db.drive.findUnique({ where: { id: driveId } });
  if (!drive) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const labelField = formData?.get("label");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }
  const label = typeof labelField === "string" && labelField.trim() ? labelField.trim() : file.name;

  const uploaded = await readFileAsDataUri(file);
  if (!uploaded.ok) {
    return NextResponse.json({ error: "validation_error", message: uploaded.message }, { status: 400 });
  }
  const storageKey = `local/${randomUUID()}-${file.name}`;

  const fileRow = await db.file.create({
    data: {
      collegeId: session.collegeId,
      storageKey,
      dataUrl: uploaded.dataUri,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      visibility: "PRIVATE",
      uploadedById: session.userId,
    },
  });

  const document = await db.driveDocument.create({
    data: { driveId, fileId: fileRow.id, label },
  });

  return NextResponse.json({ ok: true, id: document.id });
}
