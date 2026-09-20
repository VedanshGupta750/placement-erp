import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createDriveApplicationFieldSchema } from "@/lib/validators/drive";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: driveId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const drive = await db.drive.findUnique({ where: { id: driveId } });
  if (!drive) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createDriveApplicationFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const count = await db.driveApplicationField.count({ where: { driveId } });
  const field = await db.driveApplicationField.create({
    data: { driveId, order: count, ...parsed.data },
  });

  return NextResponse.json({ ok: true, id: field.id });
}
