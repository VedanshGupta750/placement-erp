import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Backing API for the wizard's Speaker step — search/list existing
// EventSpeaker rows, or create a new one inline. EventSpeaker IS a tenant
// model (collegeId column, in TENANT_MODELS) so getTenantDb scopes both
// reads and the create automatically.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const speakers = await db.eventSpeaker.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 50,
    include: { _count: { select: { events: true } } },
  });

  return NextResponse.json({
    speakers: speakers.map((s: (typeof speakers)[number]) => ({ ...s, sessionCount: s._count.events })),
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "validation_error", fieldErrors: { name: ["Name is required."] } }, { status: 400 });
  }

  const speaker = await db.eventSpeaker.create({
    data: {
      collegeId: session.collegeId,
      name,
      designation: typeof body.designation === "string" && body.designation.trim() ? body.designation.trim() : undefined,
      organization: typeof body.organization === "string" && body.organization.trim() ? body.organization.trim() : undefined,
      email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : undefined,
      phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : undefined,
      bio: typeof body.bio === "string" && body.bio.trim() ? body.bio.trim() : undefined,
      linkedinUrl: typeof body.linkedinUrl === "string" && body.linkedinUrl.trim() ? body.linkedinUrl.trim() : undefined,
      createdById: session.userId,
    },
  });

  return NextResponse.json({ speaker });
}
