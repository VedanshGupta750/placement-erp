import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validators/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from "@/lib/auth/rate-limit";
import { recordAuthAudit, authRequestContext } from "@/lib/audit";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormSubmission = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const body = isFormSubmission
    ? await request.formData().then((formData) => ({
        email: formData.get("email"),
        password: formData.get("password"),
        rememberMe: formData.get("rememberMe") === "true" || formData.get("rememberMe") === "on",
      }))
    : await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password, rememberMe } = parsed.data;
  const rateLimitKey = email.toLowerCase().trim();
  const ctx = authRequestContext(request);

  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "too_many_attempts",
        message: `Too many failed sign-in attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s), or contact your placement cell to reset your password.`,
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: rateLimitKey },
    include: { college: { select: { status: true } } },
  });

  const invalidCredentials = async () => {
    recordFailedLogin(rateLimitKey);
    if (user) {
      // Only storable when the email matched a real user — AuditLog needs
      // a collegeId. Unknown emails are logged but not stored.
      await recordAuthAudit(getTenantDb(user.collegeId), {
        collegeId: user.collegeId,
        actorId: user.id,
        action: "auth.login_failed",
        userType: user.userType,
        ...ctx,
      });
    } else {
      logger.warn("auth.login_failed_unknown_email", { email: rateLimitKey, ip: ctx.ip });
    }
    return NextResponse.json(
      { error: "invalid_credentials", message: "Invalid email or password." },
      { status: 401 },
    );
  };

  if (!user) return invalidCredentials();
  if (user.status === "DEACTIVATED" || user.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "account_disabled", message: "Your account has been disabled. Please contact your placement cell." },
      { status: 403 },
    );
  }
  if (user.college.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "college_suspended", message: "This college's access has been suspended. Contact support." },
      { status: 403 },
    );
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) return invalidCredentials();
  clearLoginAttempts(rateLimitKey);

  await createSession({
    userId: user.id,
    collegeId: user.collegeId,
    roleId: user.roleId,
    rememberMe,
  });
  if (user.status === "INVITED") {
    await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
  }

  await recordAuthAudit(getTenantDb(user.collegeId), {
    collegeId: user.collegeId,
    actorId: user.id,
    action: "auth.login",
    userType: user.userType,
    ...ctx,
  });

  if (isFormSubmission) redirect("/dashboard");
  return NextResponse.json({ ok: true, userType: user.userType });
}
