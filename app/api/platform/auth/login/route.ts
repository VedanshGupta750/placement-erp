import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { platformLoginSchema } from "@/lib/validators/platform";
import { verifyPassword } from "@/lib/auth/password";
import { createPlatformSession } from "@/lib/auth/platform-session";
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from "@/lib/auth/rate-limit";
import { recordPlatformAudit, requestContext, PLATFORM_AUDIT_ACTIONS } from "@/lib/auth/platform-audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = platformLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const ctx = requestContext(request);
  // Namespaced so a platform admin and a college user sharing an email
  // address don't consume each other's attempt budget.
  const rateLimitKey = `platform:${email.toLowerCase().trim()}`;

  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "too_many_attempts",
        message: `Too many failed sign-in attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { email: email.toLowerCase().trim() } });

  // One generic message for both "no such admin" and "wrong password" — this
  // endpoint is the highest-value target in the app, so it must not confirm
  // whether an operator address exists.
  const invalidCredentials = async (adminId: string | null) => {
    recordFailedLogin(rateLimitKey);
    // Failed attempts are recorded too — a burst of these against the
    // operator console is the earliest signal of a targeted attack.
    await recordPlatformAudit({
      platformAdminId: adminId,
      actorEmail: email.toLowerCase().trim(),
      action: PLATFORM_AUDIT_ACTIONS.LOGIN_FAILED,
      ...ctx,
    });
    return NextResponse.json({ error: "invalid_credentials", message: "Invalid email or password." }, { status: 401 });
  };

  if (!admin) return invalidCredentials(null);

  const validPassword = await verifyPassword(password, admin.passwordHash);
  if (!validPassword) return invalidCredentials(admin.id);

  clearLoginAttempts(rateLimitKey);
  await createPlatformSession(admin.id);
  await recordPlatformAudit({
    platformAdminId: admin.id,
    actorEmail: admin.email,
    action: PLATFORM_AUDIT_ACTIONS.LOGIN,
    ...ctx,
  });

  return NextResponse.json({ ok: true });
}
