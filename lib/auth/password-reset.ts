import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { setPasswordEmail, resetPasswordEmail } from "@/lib/email/templates";

export type TokenPurpose = "SET_PASSWORD" | "RESET_PASSWORD";

// A new account gets longer to act than a forgotten-password request: an
// invite may sit unread over a weekend, whereas a reset was asked for just
// now and a short window limits how long a leaked inbox is useful.
const TTL_HOURS: Record<TokenPurpose, number> = {
  SET_PASSWORD: 72,
  RESET_PASSWORD: 2,
};

/** Only the hash is ever stored, so a database dump yields no usable links. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
}

/**
 * Issues a one-time token and returns the link. Any earlier unused token for
 * the same user and purpose is consumed first, so a re-sent invite
 * invalidates the previous email rather than leaving two live links.
 */
export async function createPasswordToken(
  userId: string,
  purpose: TokenPurpose,
  collegeId?: string | null,
): Promise<{ url: string; expiresAt: Date }> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_HOURS[purpose] * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, collegeId: collegeId ?? null, tokenHash: hashToken(raw), purpose, expiresAt },
    }),
  ]);

  return { url: `${appUrl()}/set-password?token=${raw}`, expiresAt };
}

/** Resolves a raw token to its user, or null when missing/expired/used. */
export async function verifyPasswordToken(raw: string) {
  if (!raw) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/**
 * Sets the password and burns the token in one transaction — a failure
 * must never leave a password changed with the link still live.
 * Also flips an INVITED account to ACTIVE, which is what "activating" means.
 */
export async function consumePasswordToken(tokenId: string, userId: string, passwordHash: string) {
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { passwordHash, status: "ACTIVE", mustChangePassword: false } }),
    // Every other outstanding link for this user is void once they have a
    // password they chose themselves.
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
}

/**
 * Creates a token and emails the link. Returns the link too, so a caller can
 * fall back to showing it on screen when no mail provider is configured
 * yet — which is exactly the state this app ships in today.
 */
export async function sendPasswordLink(params: {
  userId: string;
  name: string;
  email: string;
  purpose: TokenPurpose;
  collegeId?: string | null;
}) {
  const { url, expiresAt } = await createPasswordToken(params.userId, params.purpose, params.collegeId);
  const expiresInHours = TTL_HOURS[params.purpose];
  const template =
    params.purpose === "SET_PASSWORD"
      ? setPasswordEmail({ name: params.name, url, expiresInHours })
      : resetPasswordEmail({ name: params.name, url, expiresInHours });

  const result = await sendEmail({ ...template, to: params.email });
  return { url, expiresAt, ...result };
}
