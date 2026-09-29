import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { importDriveRowSchema } from "@/lib/validators/import";

// Row-by-row import creating DRAFT drives — same convention as
// /api/contacts/import and /api/companies/import. Uses the ImportType
// "HISTORICAL_DRIVES" value, which existed in the schema with zero
// application code ever writing it until now. Deliberately scoped down
// from the full drive-creation form: one position per drive, no
// eligibility rule (just eligible courses), department/batch auto-picked
// the same way POST /api/drives already does for a single manual create —
// bulk CSV import isn't the place to also build a multi-position/rule CSV
// format.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "No rows to import." }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: "validation_error", message: "Import is limited to 1000 rows at a time." }, { status: 400 });
  }

  const [department, batches, courses] = await Promise.all([
    db.department.findFirstOrThrow({ select: { id: true } }),
    db.batch.findMany({ select: { id: true, year: true } }),
    db.course.findMany({ select: { id: true, name: true, specialization: true } }),
  ]);

  // A drive's batch decides whose eligibility is ever evaluated, so it must
  // be explicit: the row's own batchYear, else the batch chosen on the
  // import screen, else the batch the user is working in. Falling through to
  // "newest year" silently is what made every drive land on one cohort.
  const activeBatchId = await getActiveBatchId();
  const selectedBatchId = typeof body?.batchId === "string" ? body.batchId : null;
  const fallbackBatch =
    batches.find((b) => b.id === selectedBatchId) ??
    batches.find((b) => b.id === activeBatchId) ??
    [...batches].sort((a, b) => b.year - a.year)[0];

  if (!fallbackBatch) {
    return NextResponse.json(
      { error: "no_batch", message: "Create a batch in Settings before importing drives." },
      { status: 400 },
    );
  }

  const importRecord = await db.import.create({
    data: {
      collegeId: session.collegeId,
      type: "HISTORICAL_DRIVES",
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
    const parsed = importDriveRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ rowNumber, field: String(first.path[0] ?? ""), errorCode: "VALIDATION", message: first.message });
      continue;
    }
    const data = parsed.data;
    const rowBatch = data.batchYear ? batches.find((b) => b.year === data.batchYear) : fallbackBatch;
    if (!rowBatch) {
      errors.push({
        rowNumber,
        field: "batchYear",
        errorCode: "UNKNOWN_BATCH",
        message: `Batch ${data.batchYear} doesn't exist yet — create it in Settings first.`,
      });
      continue;
    }

    const wantedNames = data.courseNames.split(",").map((n) => n.trim().toLowerCase()).filter(Boolean);
    const matchedCourseIds = courses
      .filter((c) => wantedNames.some((n) => c.name.toLowerCase().includes(n) || (c.specialization ?? "").toLowerCase().includes(n)))
      .map((c) => c.id);
    if (matchedCourseIds.length === 0) {
      errors.push({ rowNumber, field: "courseNames", errorCode: "UNKNOWN_COURSE", message: `No course matched "${data.courseNames}".` });
      continue;
    }

    try {
      const company = await db.company.upsert({
        where: { name: data.companyName },
        create: { name: data.companyName },
        update: {},
      });
      await db.collegePartnership.upsert({
        where: { collegeId_companyId: { collegeId: session.collegeId, companyId: company.id } },
        create: { collegeId: session.collegeId, companyId: company.id, status: "ACTIVE", connectedAt: new Date() },
        update: {},
      });

      await db.drive.create({
        data: {
          collegeId: session.collegeId,
          batchId: rowBatch.id,
          departmentId: department.id,
          companyId: company.id,
          createdById: session.userId,
          title: data.title,
          status: "DRAFT",
          locationCategory: "ON_CAMPUS",
          expectedOpenings: data.openings,
          registrationOpensAt: new Date(),
          registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : undefined,
          eligibleCourses: { create: matchedCourseIds.map((courseId) => ({ courseId })) },
          positions: {
            create: {
              collegeId: session.collegeId,
              title: data.title,
              positionType: data.positionType,
              employmentType: data.employmentType,
              minCtc: data.minCtc,
              maxCtc: data.maxCtc,
              openings: data.openings,
            },
          },
          historyEntries: { create: { actorId: session.userId, action: "CREATED_VIA_IMPORT" } },
        },
      });
      successRows += 1;
    } catch {
      errors.push({ rowNumber, errorCode: "UNKNOWN", message: "Couldn't create this drive." });
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
