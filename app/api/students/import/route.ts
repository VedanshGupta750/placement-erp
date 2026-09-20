import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { importStudentRowSchema } from "@/lib/validators/import";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";

// Row-by-row import (not a single bulk insert) so one bad row doesn't fail
// the whole file — every row gets its own validation + duplicate check, and
// failures are recorded on the Import record with a row number and reason
// rather than surfacing one opaque 500. See lib/validators/import.ts for
// the expected column shape.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.bulk_update");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "No rows to import." }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: "validation_error", message: "Import is limited to 2000 rows at a time." }, { status: 400 });
  }

  const studentRole = await db.role.findFirst({ where: { name: "Student" } });
  const department = await db.department.findFirst();

  const importRecord = await db.import.create({
    data: {
      collegeId: session.collegeId,
      type: "STUDENTS",
      status: "PROCESSING",
      fileName: body?.fileName ?? "upload.csv",
      totalRows: rows.length,
      startedById: session.userId,
    },
  });

  let successRows = 0;
  const errors: { rowNumber: number; field?: string; errorCode: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // header is row 1
    const parsed = importStudentRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ rowNumber, field: String(first.path[0] ?? ""), errorCode: "VALIDATION", message: first.message });
      continue;
    }
    const data = parsed.data;

    try {
      const [existingUser, course, batch] = await Promise.all([
        db.user.findUnique({ where: { email: data.email.toLowerCase().trim() } }),
        db.course.findFirst({ where: { name: data.courseName } }),
        db.batch.findFirst({ where: { year: data.batchYear } }),
      ]);
      if (existingUser) {
        errors.push({ rowNumber, field: "email", errorCode: "DUPLICATE_EMAIL", message: "A user with this email already exists." });
        continue;
      }
      if (!course) {
        errors.push({ rowNumber, field: "courseName", errorCode: "UNKNOWN_COURSE", message: `Course "${data.courseName}" not found in the course master.` });
        continue;
      }
      if (!batch) {
        errors.push({ rowNumber, field: "batchYear", errorCode: "UNKNOWN_BATCH", message: `Batch ${data.batchYear} doesn't exist yet — create it in Settings first.` });
        continue;
      }
      const existingEnrollment = await db.student.findFirst({ where: { enrollmentNumber: data.enrollmentNumber } });
      if (existingEnrollment) {
        errors.push({ rowNumber, field: "enrollmentNumber", errorCode: "DUPLICATE_ENROLLMENT", message: "A student with this enrollment number already exists." });
        continue;
      }

      const passwordHash = await hashPassword(generateTempPassword());
      const user = await db.user.create({
        data: { collegeId: session.collegeId, email: data.email.toLowerCase().trim(), name: data.name, passwordHash, status: "INVITED", userType: "STUDENT", roleId: studentRole?.id },
      });
      await db.student.create({
        data: {
          userId: user.id,
          collegeId: session.collegeId,
          departmentId: department?.id,
          batchId: batch.id,
          courseId: course.id,
          enrollmentNumber: data.enrollmentNumber,
          aggregate: data.aggregate,
          aggregateType: "CGPA",
          liveBacklogs: data.liveBacklogs ?? 0,
        },
      });
      successRows += 1;
    } catch {
      errors.push({ rowNumber, errorCode: "UNKNOWN", message: "Couldn't create this student." });
    }
  }

  await db.import.update({
    where: { id: importRecord.id },
    data: {
      status: errors.length === 0 ? "COMPLETED" : successRows === 0 ? "FAILED" : "COMPLETED_WITH_ERRORS",
      successRows,
      errorRows: errors.length,
      completedAt: new Date(),
      errors: { create: errors },
    },
  });

  return NextResponse.json({ ok: true, importId: importRecord.id, successRows, errorRows: errors.length, errors: errors.slice(0, 50) });
}
