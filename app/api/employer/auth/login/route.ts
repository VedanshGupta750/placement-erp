import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createCompanySession } from "@/lib/auth/company-session";
import { logger } from "@/lib/logger";
import { authRequestContext } from "@/lib/audit";
import { companyLoginSchema } from "@/lib/validators/auth";
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from "@/lib/auth/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = companyLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const rateLimitKey = `employer:${parsed.data.email.toLowerCase().trim()}`;
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "too_many_attempts",
        message: `Too many failed sign-in attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s), or contact the college placement cell to reset your password.`,
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.companyUser.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });
  // Recruiter sign-ins are logged, not written to AuditLog: a CompanyUser
  // belongs to a Company that may partner with many colleges, so there is
  // no single collegeId for the row AuditLog requires.
  const ctx = authRequestContext(request);
  const invalidCredentials = () => {
    recordFailedLogin(rateLimitKey);
    logger.warn("employer.login_failed", { email: rateLimitKey, companyId: user?.companyId ?? null, ip: ctx.ip });
    return NextResponse.json({ error: "invalid_credentials", message: "Invalid email or password." }, { status: 401 });
  };
  if (!user) return invalidCredentials();
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "account_disabled", message: "Your account isn't active. Contact your admin." }, { status: 403 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return invalidCredentials();
  clearLoginAttempts(rateLimitKey);

  await createCompanySession({ companyUserId: user.id, companyId: user.companyId });
  logger.info("employer.login", { companyUserId: user.id, companyId: user.companyId, ip: ctx.ip });
  return NextResponse.json({ ok: true });
}
