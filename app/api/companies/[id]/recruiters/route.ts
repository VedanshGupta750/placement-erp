import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { inviteRecruiterSchema } from "@/lib/validators/auth";

// Recruiter PORTAL accounts (CompanyUser — real login credentials into
// /employer) are a fully separate thing from Contact (the CRM record of a
// recruiter relationship, shown in RecruitersTab above this). Before this
// route, there was no in-app way to create a CompanyUser at all — every
// existing one (including the demo account) was seeded directly into the
// database. Same "no email provider, temp password returned once" pattern
// as the staff invite flow (see app/api/people/invite/route.ts).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: companyId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // Company/CompanyUser are global (not tenant-scoped — a company can
  // partner with many colleges), so confirm the caller's college actually
  // has a live partnership with this company before letting them grant
  // portal access to it.
  const partnership = await db.collegePartnership.findFirst({ where: { companyId } });
  if (!partnership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = inviteRecruiterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.companyUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_taken", message: "This email already has a recruiter portal account." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await prisma.companyUser.create({
    data: { companyId, email, name: parsed.data.name, passwordHash, status: "ACTIVE" },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.recruiter_invited",
    resourceType: "Company",
    resourceId: companyId,
    after: { email, name: parsed.data.name },
  });

  return NextResponse.json({ ok: true, userId: user.id, tempPassword });
}
