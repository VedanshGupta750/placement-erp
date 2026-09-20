import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { importContactRowSchema } from "@/lib/validators/import";
import { CONTACT_TYPES, RELATIONSHIP_STAGES } from "@/lib/validators/contact";
import { logContactHistory } from "@/lib/contacts/history";

// Row-by-row import (not a single bulk insert) so one bad row doesn't fail
// the whole file — same convention as /api/students/import.
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
      type: "CONTACTS",
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
    const parsed = importContactRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ rowNumber, field: String(first.path[0] ?? ""), errorCode: "VALIDATION", message: first.message });
      continue;
    }
    const data = parsed.data;

    try {
      if (data.email) {
        const existing = await db.contact.findFirst({ where: { email: data.email.toLowerCase().trim() } });
        if (existing) {
          errors.push({ rowNumber, field: "email", errorCode: "DUPLICATE_EMAIL", message: "A contact with this email already exists." });
          continue;
        }
      }

      let companyId: string | undefined;
      if (data.companyName) {
        const company = await db.company.findFirst({ where: { name: data.companyName } });
        if (!company) {
          errors.push({ rowNumber, field: "companyName", errorCode: "UNKNOWN_COMPANY", message: `Company "${data.companyName}" not found — add it under Companies first.` });
          continue;
        }
        companyId = company.id;
      }

      if (data.contactType && !CONTACT_TYPES.includes(data.contactType as (typeof CONTACT_TYPES)[number])) {
        errors.push({ rowNumber, field: "contactType", errorCode: "INVALID_CONTACT_TYPE", message: `"${data.contactType}" isn't a recognized contact type.` });
        continue;
      }
      if (data.relationshipStage && !RELATIONSHIP_STAGES.includes(data.relationshipStage as (typeof RELATIONSHIP_STAGES)[number])) {
        errors.push({ rowNumber, field: "relationshipStage", errorCode: "INVALID_STAGE", message: `"${data.relationshipStage}" isn't a recognized relationship stage.` });
        continue;
      }

      const contact = await db.contact.create({
        data: {
          collegeId: session.collegeId,
          name: data.name,
          email: data.email ? data.email.toLowerCase().trim() : undefined,
          phone: data.phone || undefined,
          companyId,
          contactType: data.contactType || undefined,
          designation: data.designation || undefined,
          relationshipStage: data.relationshipStage || "NEW",
          addedById: session.userId,
        },
      });
      await logContactHistory(db, contact.id, session.userId, "Contact created (import)");
      successRows += 1;
    } catch {
      errors.push({ rowNumber, errorCode: "UNKNOWN", message: "Couldn't create this contact." });
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
