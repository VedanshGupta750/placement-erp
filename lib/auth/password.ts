// No "server-only" guard — this is shared with prisma/seed.ts, which runs
// as a plain Node script outside Next.js's bundler.
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const SALT_ROUNDS = 12;

// Used for the staff/student-invite flow (accounts are TPO-created, not
// self-registered) — the temporary password is returned once in the invite
// API response for the inviter to share manually, never stored in plaintext.
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
