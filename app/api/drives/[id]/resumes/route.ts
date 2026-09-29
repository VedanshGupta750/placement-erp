import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Every resume attached to a drive's applications, as one ZIP. Screening a
// drive otherwise means opening each application page in turn just to reach
// the file. Mirrors app/api/students/bulk/documents/route.ts.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    // Reading applicants' resumes is the same disclosure as exporting the
    // application list, so it is gated on the same permission.
    await requirePermission(session, "application.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drive = await db.drive.findUnique({ where: { id: driveId }, select: { title: true } });
  if (!drive) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // `status` narrows to a shortlist when the TPO only wants those; absent,
  // every applicant's resume comes through. Validated against the enum so an
  // arbitrary query string can't reach Prisma.
  const STATUSES = [
    "REGISTERED", "APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED",
    "ROUND_IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN",
  ] as const;
  type ApplicationStatusKey = (typeof STATUSES)[number];
  const statusParam = new URL(request.url).searchParams.get("status");
  const status = STATUSES.includes(statusParam as ApplicationStatusKey)
    ? (statusParam as ApplicationStatusKey)
    : undefined;

  const applications = await db.application.findMany({
    where: { driveId, ...(status ? { status } : {}), resumeId: { not: null } },
    select: {
      status: true,
      student: { select: { enrollmentNumber: true, user: { select: { name: true } } } },
      resume: { select: { name: true, file: { select: { dataUrl: true, originalName: true } } } },
    },
    orderBy: { student: { enrollmentNumber: "asc" } },
  });

  const zip = new JSZip();
  let fileCount = 0;
  const missing: string[] = [];

  for (const a of applications) {
    const dataUrl = a.resume?.file?.dataUrl;
    const studentLabel = `${a.student.enrollmentNumber} ${a.student.user.name}`.replace(/[\\/:*?"<>|]/g, "-");
    if (!dataUrl) {
      missing.push(studentLabel);
      continue;
    }
    const base64 = dataUrl.split(",")[1] ?? "";
    // Named by enrollment number first so the ZIP sorts the way a merit or
    // roll list does, not by whatever the student called their own file.
    const original = a.resume?.file?.originalName ?? `${a.resume?.name ?? "resume"}.pdf`;
    const extension = original.includes(".") ? original.slice(original.lastIndexOf(".")) : ".pdf";
    zip.file(`${studentLabel}${extension}`, base64, { base64: true });
    fileCount += 1;
  }

  if (fileCount === 0) {
    return NextResponse.json(
      { error: "not_found", message: "No downloadable resumes are attached to this drive's applications." },
      { status: 404 },
    );
  }

  // A manifest rather than silently dropping them — otherwise a TPO counts
  // 60 applicants, gets 57 files, and has no idea which three are missing.
  if (missing.length > 0) {
    zip.file(
      "_missing-resumes.txt",
      `These applicants had no downloadable resume file attached:\n\n${missing.join("\n")}\n`,
    );
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  const safeTitle = drive.title.replace(/[\\/:*?"<>|]/g, "-");
  return new NextResponse(new Blob([new Uint8Array(bytes)]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeTitle} resumes.zip"`,
    },
  });
}
