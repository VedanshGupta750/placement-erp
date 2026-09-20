import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlatformSession } from "@/lib/auth/platform-session";
import { createCollegeSchema } from "@/lib/validators/platform";
import { provisionCollege } from "@/lib/provisioning";
import { recordPlatformAudit, requestContext, PLATFORM_AUDIT_ACTIONS } from "@/lib/auth/platform-audit";

// Every route under /api/platform is cross-tenant by definition, so these
// use the raw prisma client rather than getTenantDb — the platform session
// IS the authorization boundary here. Each handler re-checks it.

export async function GET() {
  const admin = await getPlatformSession();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const colleges = await prisma.college.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({ colleges });
}

export async function POST(request: Request) {
  const admin = await getPlatformSession();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createCollegeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // User.email is globally unique across every tenant, so this has to be
  // checked before provisioning rather than letting the transaction fail
  // partway and surface as a 500.
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.tpoEmail.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json(
      { error: "email_taken", message: "A user with this email already exists." },
      { status: 409 },
    );
  }

  const result = await provisionCollege(parsed.data);

  await recordPlatformAudit({
    platformAdminId: admin.id,
    actorEmail: admin.email,
    action: PLATFORM_AUDIT_ACTIONS.COLLEGE_CREATED,
    targetType: "College",
    targetId: result.collegeId,
    targetLabel: parsed.data.collegeName,
    // The TPO's email is recorded; the password never is.
    metadata: { tpoEmail: parsed.data.tpoEmail.toLowerCase().trim(), tpoName: parsed.data.tpoName },
    ...requestContext(request),
  });

  // Note: no session is created here. The operator stays signed in as
  // themselves — the old public signup route logged the new TPO straight
  // in, which would be wrong for an admin creating an account for someone else.
  return NextResponse.json({ ok: true, collegeId: result.collegeId, userId: result.userId });
}
