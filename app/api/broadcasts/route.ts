import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createBroadcastSchema } from "@/lib/validators/broadcast";

export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "broadcast.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const broadcasts = await db.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { recipients: true } } },
  });
  return NextResponse.json({ broadcasts });
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
  const parsed = createBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const broadcast = await db.broadcast.create({
    data: {
      collegeId: session.collegeId,
      createdById: session.userId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      audienceType: parsed.data.audienceType,
      audienceBatchId: parsed.data.audienceBatchId,
      audienceDepartmentId: parsed.data.audienceDepartmentId,
      audienceCourseId: parsed.data.audienceCourseId,
      audienceRole: parsed.data.audienceRole,
    },
  });
  return NextResponse.json({ ok: true, id: broadcast.id });
}
