import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { importCompanyRowSchema } from "@/lib/validators/import";
import { COMPANY_SIZES, HIRING_TYPES } from "@/lib/validators/company";

// Row-by-row import (not a single bulk insert) so one bad row doesn't fail
// the whole file — same convention as /api/contacts/import. A row whose
// name matches an existing global Company reuses it (adds/updates this
// college's partnership) rather than erroring, since Company is shared
// across colleges — this mirrors POST /api/companies' own reuse logic.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.create");
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

  const importRecord = await db.import.create({
    data: {
      collegeId: session.collegeId,
      type: "COMPANIES",
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
    const parsed = importCompanyRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ rowNumber, field: String(first.path[0] ?? ""), errorCode: "VALIDATION", message: first.message });
      continue;
    }
    const data = parsed.data;

    if (data.size && !COMPANY_SIZES.includes(data.size as (typeof COMPANY_SIZES)[number])) {
      errors.push({ rowNumber, field: "size", errorCode: "INVALID_SIZE", message: `"${data.size}" isn't a recognized company size.` });
      continue;
    }
    if (data.hiringType && !HIRING_TYPES.includes(data.hiringType as (typeof HIRING_TYPES)[number])) {
      errors.push({ rowNumber, field: "hiringType", errorCode: "INVALID_HIRING_TYPE", message: `"${data.hiringType}" isn't a recognized hiring type.` });
      continue;
    }

    try {
      const existing = await prisma.company.findUnique({ where: { name: data.name } });
      const company = existing
        ? await prisma.company.update({
            where: { id: existing.id },
            data: {
              industryType: data.industryType || existing.industryType,
              website: data.website || existing.website,
              headquarters: data.headquarters || existing.headquarters,
              size: data.size || existing.size,
              hiringType: data.hiringType || existing.hiringType,
            },
          })
        : await prisma.company.create({
            data: {
              name: data.name,
              industryType: data.industryType,
              website: data.website,
              headquarters: data.headquarters,
              size: data.size,
              hiringType: data.hiringType,
            },
          });

      await db.collegePartnership.upsert({
        where: { collegeId_companyId: { collegeId: session.collegeId, companyId: company.id } },
        create: { collegeId: session.collegeId, companyId: company.id, status: "PENDING" },
        update: {},
      });

      successRows += 1;
    } catch {
      errors.push({ rowNumber, errorCode: "UNKNOWN", message: "Couldn't create this company." });
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
