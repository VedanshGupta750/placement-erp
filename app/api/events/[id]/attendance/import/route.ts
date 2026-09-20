import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

type ImportRow = { row: number; email: string; present: boolean };

// Bulk attendance marking from a CSV (Email,Present columns — parsed
// client-side, posted here as {rows}). Row-by-row, same "one bad row
// doesn't fail the batch" philosophy as /api/students/import, but kept as
// a plain inline JSON response rather than a persisted Import/ImportError
// record — this is a small, low-volume, event-scoped bulk action, not
// worth the full Import model machinery.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.mark_attendance");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "validation_error", message: "No rows to import." }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: "validation_error", message: "Import is limited to 2000 rows at a time." }, { status: 400 });
  }

  const parsedRows: ImportRow[] = rows
    .map((r, i) => {
      const rec = r as { email?: unknown; present?: unknown };
      const email = typeof rec.email === "string" ? rec.email.trim().toLowerCase() : "";
      return { row: i + 2, email, present: rec.present === true }; // +2: header row + 1-index
    })
    .filter((r) => r.email);

  const registrations = await db.eventRegistration.findMany({
    where: { eventId, status: { in: ["CONFIRMED", "PENDING"] } },
    include: { user: { select: { id: true, email: true } } },
  });
  const userIdByEmail = new Map(registrations.map((r) => [r.user.email.toLowerCase(), r.userId]));

  let successRows = 0;
  const errors: { row: number; email: string; message: string }[] = [];

  for (const r of parsedRows) {
    const userId = userIdByEmail.get(r.email);
    if (!userId) {
      errors.push({ row: r.row, email: r.email, message: "Not a registered student for this event." });
      continue;
    }
    await db.eventAttendance.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, checkInAt: r.present ? new Date() : null, method: "IMPORT", markedById: session.userId },
      update: { checkInAt: r.present ? new Date() : null, method: "IMPORT", markedById: session.userId },
    });
    successRows += 1;
  }

  if (successRows > 0) {
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "event.attendance_marked",
      resourceType: "Event",
      resourceId: eventId,
      after: { importedRows: successRows, errorRows: errors.length },
    });
  }

  return NextResponse.json({ ok: true, successRows, errors });
}
