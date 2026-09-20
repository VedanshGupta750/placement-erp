import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { scorecardTemplateSchema } from "@/lib/validators/round";

export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const roundType = new URL(request.url).searchParams.get("roundType");
  const templates = await db.scorecardTemplate.findMany({
    where: roundType ? { roundType } : undefined,
    orderBy: { roundType: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "round.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = scorecardTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const template = await db.scorecardTemplate.create({
      data: { collegeId: session.collegeId, roundType: parsed.data.roundType, criteria: parsed.data.criteria },
    });
    return NextResponse.json({ ok: true, id: template.id });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "already_exists", message: `A scorecard already exists for "${parsed.data.roundType}".` }, { status: 409 });
    }
    throw e;
  }
}
