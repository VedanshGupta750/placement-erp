import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createTemplateSchema } from "@/lib/validators/broadcast";

export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "broadcast.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const templates = await db.messageTemplate.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "broadcast.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const template = await db.messageTemplate.create({
    data: { collegeId: session.collegeId, name: parsed.data.name, subject: parsed.data.subject, body: parsed.data.body, createdById: session.userId },
  });
  return NextResponse.json({ ok: true, id: template.id });
}
