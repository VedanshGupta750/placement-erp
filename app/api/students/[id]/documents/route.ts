import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";
import { recordAudit } from "@/lib/audit";
import type { StudentDocumentCategory } from "@/lib/generated/prisma/enums";
import { requireNotSelfServiceStudent, StaffOnlyError } from "@/lib/students/guard";

const CATEGORIES = new Set([
  "RESUME",
  "TENTH_MARKSHEET",
  "TWELFTH_MARKSHEET",
  "DIPLOMA_MARKSHEET",
  "SEMESTER_MARKSHEET",
  "ID_PROOF",
  "CERTIFICATE",
  "OFFER_LETTER",
  "JOINING_LETTER",
  "OTHER",
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: studentId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.edit");
    await requireNotSelfServiceStudent(db, session);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof StaffOnlyError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const category = formData?.get("category");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }

  const result = await readFileAsDataUri(file);
  if (!result.ok) {
    return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
  }

  const document = await db.studentDocument.create({
    data: {
      studentId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl: result.dataUri,
      category: typeof category === "string" && CATEGORIES.has(category) ? (category as StudentDocumentCategory) : "OTHER",
      uploadedById: session.userId,
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "student.document_uploaded",
    resourceType: "Student",
    resourceId: studentId,
    after: { fileName: file.name, category: document.category },
  });

  return NextResponse.json({ ok: true, id: document.id });
}
