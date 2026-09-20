import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";

export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const views = await db.applicationSavedView.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { name: ["Name is required."] } }, { status: 400 });
  }
  const filters = body?.filters && typeof body.filters === "object" ? body.filters : {};

  const view = await db.applicationSavedView.create({
    data: { collegeId: session.collegeId, userId: session.userId, name, filters },
  });
  return NextResponse.json({ ok: true, view });
}
