import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId } });
  if (!student) {
    return NextResponse.json({ error: "not_a_student" }, { status: 403 });
  }

  try {
    await requirePermission(session, "resume.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const nameField = formData?.get("name");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }
  const name = typeof nameField === "string" && nameField.trim() ? nameField.trim() : file.name;

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

  const existingCount = await db.resume.count({ where: { studentId: student.id } });

  const resume = await db.resume.create({
    data: {
      collegeId: session.collegeId,
      studentId: student.id,
      name,
      fileId: fileRow.id,
      isDefault: existingCount === 0,
    },
  });

  return NextResponse.json({ ok: true, id: resume.id });
}
