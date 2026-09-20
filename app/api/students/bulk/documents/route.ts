import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";

// Bundles every StudentDocument for the selected students into a single ZIP
// — files are stored as data URIs (no object storage backend in this app),
// decoded back to binary here and written under one folder per student
// (enrollment number) so recruiters/verifiers can tell whose documents are
// whose.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "No students selected." }, { status: 400 });
  }

  const scopeWhere = await getStudentScopeWhere(db, session);
  const students = await db.student.findMany({
    where: { id: { in: ids }, ...scopeWhere },
    select: { id: true, enrollmentNumber: true, documents: { select: { fileName: true, dataUrl: true } } },
  });

  const zip = new JSZip();
  let fileCount = 0;
  for (const s of students) {
    const folder = zip.folder(s.enrollmentNumber)!;
    for (const doc of s.documents) {
      const base64 = doc.dataUrl.split(",")[1] ?? "";
      folder.file(doc.fileName, base64, { base64: true });
      fileCount += 1;
    }
  }

  if (fileCount === 0) {
    return NextResponse.json({ error: "not_found", message: "No documents on file for the selected students." }, { status: 404 });
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  const blob = new Blob([new Uint8Array(bytes)]);
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="student-documents.zip"`,
    },
  });
}
