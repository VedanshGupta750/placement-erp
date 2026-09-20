import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { readImageAsDataUri } from "@/lib/uploads/image-data-uri";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose an image to upload." }, { status: 400 });
  }

  const result = await readImageAsDataUri(file);
  if (!result.ok) {
    return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
  }

  await db.contact.update({ where: { id }, data: { photoUrl: result.dataUri } });

  return NextResponse.json({ ok: true, photoUrl: result.dataUri });
}
