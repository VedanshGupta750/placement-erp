import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlatformSession } from "@/lib/auth/platform-session";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { recordPlatformAudit, requestContext, PLATFORM_AUDIT_ACTIONS } from "@/lib/auth/platform-audit";

// Recovery path for a college locked out of its own TPO account. Returns a
// temporary password exactly once, for the operator to pass on out of band
// — same convention as the staff invite flow, since no email provider is
// wired up. Never stored or logged in plaintext.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformSession();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: collegeId } = await params;

  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true } });
  if (!college) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The TPO is whoever currently holds the college's TPO role — resolved
  // by role rather than by "first user", so it still works after staff
  // changes. Oldest first, so a college with several keeps a stable answer.
  const tpoRole = await prisma.role.findFirst({ where: { collegeId, name: "TPO" }, select: { id: true } });
  if (!tpoRole) return NextResponse.json({ error: "no_tpo_role", message: "This college has no TPO role." }, { status: 404 });

  const tpo = await prisma.user.findFirst({
    where: { collegeId, roleId: tpoRole.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!tpo) {
    return NextResponse.json({ error: "no_tpo_user", message: "This college has no user holding the TPO role." }, { status: 404 });
  }

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id: tpo.id },
    // Reactivated as well as reset — a suspended or deactivated TPO would
    // otherwise still be blocked at login by a fresh password.
    data: { passwordHash: await hashPassword(tempPassword), status: "ACTIVE" },
  });

  await recordPlatformAudit({
    platformAdminId: admin.id,
    actorEmail: admin.email,
    action: PLATFORM_AUDIT_ACTIONS.TPO_PASSWORD_RESET,
    targetType: "User",
    targetId: tpo.id,
    targetLabel: `${tpo.name} <${tpo.email}>`,
    // Records that a reset happened and for whom — never the password.
    metadata: { collegeId },
    ...requestContext(request),
  });

  return NextResponse.json({ ok: true, email: tpo.email, name: tpo.name, tempPassword });
}
