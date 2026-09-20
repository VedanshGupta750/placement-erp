import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readFileAsDataUri } from "@/lib/uploads/file-data-uri";
import type { EventFileCategory } from "@/lib/generated/prisma/client";

const VALID_CATEGORIES = new Set<EventFileCategory>([
  "BROCHURE",
  "AGENDA",
  "SPEAKER_PPT",
  "ATTENDANCE_SHEET",
  "CERTIFICATE_TEMPLATE",
  "RECORDING",
  "PHOTO",
  "FEEDBACK_REPORT",
  "OTHER",
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose a file to upload." }, { status: 400 });
  }

  const categoryRaw = formData.get("category");
  const category: EventFileCategory =
    typeof categoryRaw === "string" && VALID_CATEGORIES.has(categoryRaw as EventFileCategory)
      ? (categoryRaw as EventFileCategory)
      : "OTHER";

  const result = await readFileAsDataUri(file);
  if (!result.ok) {
    return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
  }

  const eventFile = await db.eventFile.create({
    data: { eventId, name: file.name, url: result.dataUri, category, uploadedById: session.userId },
  });

  return NextResponse.json({ ok: true, id: eventFile.id });
}
