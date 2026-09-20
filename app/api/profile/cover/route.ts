import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { readImageAsDataUri } from "@/lib/uploads/image-data-uri";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_error", message: "Choose an image to upload." }, { status: 400 });
  }

  const result = await readImageAsDataUri(file);
  if (!result.ok) {
    return NextResponse.json({ error: "validation_error", message: result.message }, { status: 400 });
  }

  await db.user.update({ where: { id: session.userId }, data: { coverImageUrl: result.dataUri } });

  return NextResponse.json({ ok: true, coverImageUrl: result.dataUri });
}
