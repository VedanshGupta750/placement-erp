import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Audit trail for the platform/Super Admin tier. Separate from
// lib/audit.ts because AuditLog requires a collegeId and a tenant User as
// the actor — a platform admin is neither, and events like a failed login
// have no college at all.
//
// Every write also goes to the structured log, so the trail survives even
// if the database is the thing that is broken (which is exactly when you
// most want to know who did what).

export const PLATFORM_AUDIT_ACTIONS = {
  LOGIN: "platform.login",
  LOGIN_FAILED: "platform.login_failed",
  LOGOUT: "platform.logout",
  COLLEGE_CREATED: "platform.college_created",
  TPO_PASSWORD_RESET: "platform.tpo_password_reset",
} as const;

export const PLATFORM_AUDIT_LABELS: Record<string, string> = {
  "platform.login": "Signed in",
  "platform.login_failed": "Failed sign-in attempt",
  "platform.logout": "Signed out",
  "platform.college_created": "College created",
  "platform.tpo_password_reset": "TPO password reset",
};

/**
 * Pulls caller identity off the request for the audit row. `x-forwarded-for`
 * is set by whatever proxy sits in front of the app; its first entry is the
 * original client. Treated as a hint for investigation, never as identity —
 * it is trivially spoofable when the app is reachable directly.
 */
export function requestContext(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function recordPlatformAudit(input: {
  platformAdminId: string | null;
  actorEmail: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  logger.info("platform.audit", {
    action: input.action,
    actorEmail: input.actorEmail,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    ip: input.ip,
  });

  try {
    await prisma.platformAuditLog.create({
      data: {
        platformAdminId: input.platformAdminId,
        actorEmail: input.actorEmail,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        metadata: (input.metadata as never) ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    // Auditing must never break the action it is recording — but unlike the
    // tenant helper this does not swallow silently, because a platform
    // audit that vanished is itself worth alerting on.
    logger.error("platform.audit_write_failed", {
      action: input.action,
      actorEmail: input.actorEmail,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
