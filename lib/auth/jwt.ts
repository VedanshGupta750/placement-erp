import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET environment variable is not set");
}
const encodedSecret = new TextEncoder().encode(secret);

// Deliberately minimal payload — no permissions embedded (a 1-day token with
// stale permissions after a revoke is a real bug risk). lib/rbac/guard.ts
// resolves roleId -> permission keys fresh per request instead.
export type SessionPayload = JWTPayload & {
  sub: string; // userId
  collegeId: string;
  roleId: string | null;
};

const DEFAULT_EXPIRY = "1d";

export async function signSessionToken(payload: SessionPayload, expiresIn: string = DEFAULT_EXPIRY): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedSecret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.collegeId !== "string" ||
      payload.typ !== undefined // tenant tokens never carry `typ` — see below
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// Company (recruiter) sessions are a distinct token kind — a recruiter
// account belongs to a Company, not a College, and can be connected to many
// colleges via CollegePartnership. Carries a `typ` discriminator so a
// tenant session token can never be replayed as a company one or vice versa.
export type CompanySessionPayload = JWTPayload & {
  sub: string; // companyUserId
  companyId: string;
  typ: "company";
};

export async function signCompanySessionToken(payload: {
  companyUserId: string;
  companyId: string;
}): Promise<string> {
  return new SignJWT({ companyId: payload.companyId, typ: "company" } satisfies Omit<
    CompanySessionPayload,
    "sub"
  >)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.companyUserId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedSecret);
}

export async function verifyCompanySessionToken(token: string): Promise<CompanySessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.typ !== "company" || typeof payload.companyId !== "string") {
      return null;
    }
    return payload as CompanySessionPayload;
  } catch {
    return null;
  }
}

// Outbound SSO handoff to the standalone Assessment microservice
// (~/placement-erp-assessments, a genuinely separate app/DB). Short-lived
// and one-shot by design — it's a browser-redirect ticket, not a session.
// `typ: "assessment_sso"` keeps it from ever being replayed as a tenant
// session token here or anywhere else. Only STUDENT / PLACEMENT_TEAM users
// can SSO in — that's all the receiving side's UserType enum accepts.
export type AssessmentSsoPayload = JWTPayload & {
  sub: string; // userId
  collegeId: string;
  name: string;
  email: string;
  userType: "STUDENT" | "PLACEMENT_TEAM";
  typ: "assessment_sso";
};

export async function signAssessmentSsoToken(payload: {
  userId: string;
  collegeId: string;
  name: string;
  email: string;
  userType: "STUDENT" | "PLACEMENT_TEAM";
}): Promise<string> {
  return new SignJWT({
    collegeId: payload.collegeId,
    name: payload.name,
    email: payload.email,
    userType: payload.userType,
    typ: "assessment_sso",
  } satisfies Omit<AssessmentSsoPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(encodedSecret);
}

// Platform-admin sessions — the SaaS operator's own staff, outside every
// tenant college. Same secret, distinct `typ`.
export type PlatformAdminSessionPayload = JWTPayload & {
  sub: string; // platformAdminId
  typ: "platform_admin";
};

export async function signPlatformAdminToken(platformAdminId: string): Promise<string> {
  return new SignJWT({ typ: "platform_admin" } satisfies Pick<PlatformAdminSessionPayload, "typ">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(platformAdminId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(encodedSecret);
}

export async function verifyPlatformAdminToken(token: string): Promise<PlatformAdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.typ !== "platform_admin") {
      return null;
    }
    return payload as PlatformAdminSessionPayload;
  } catch {
    return null;
  }
}
