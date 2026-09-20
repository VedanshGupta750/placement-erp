import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { inviteUserSchema } from "@/lib/validators/people";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";

// Creates the User immediately in INVITED status (rather than a
// request-only row that later provisions a User) — simpler for v1, still
// tracked in InviteRequest for the funnel view on the People page. The temp
// password is returned once in the response for the TPO to share manually,
// never stored in plaintext or emailed automatically (no email provider is
// wired up yet).
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "settings.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "email_taken", message: "This email is already registered." }, { status: 409 });
  }

  let roleId = data.roleId;
  if (!roleId) {
    const defaultRoleName = data.userType === "STUDENT" ? "Student" : data.userType === "FACULTY" ? "Faculty" : data.userType === "MANAGEMENT" ? "Management" : "Placement Coordinator";
    const role = await db.role.findFirst({ where: { name: defaultRoleName } });
    roleId = role?.id;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await db.user.create({
    data: {
      collegeId: session.collegeId,
      email: data.email.toLowerCase().trim(),
      name: data.name,
      passwordHash,
      status: "INVITED",
      userType: data.userType,
      roleId,
    },
  });

  await db.inviteRequest.create({
    data: { collegeId: session.collegeId, email: data.email.toLowerCase().trim(), name: data.name, userType: data.userType, status: "INVITED", invitedAt: new Date() },
  });

  return NextResponse.json({ ok: true, userId: user.id, tempPassword });
}
