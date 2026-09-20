import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { signPlatformAdminToken, verifyPlatformAdminToken } from "@/lib/auth/jwt";

// Deliberately a different cookie name from the tenant and company
// sessions, so holding one never implies the others. The JWT itself also
// carries typ:"platform_admin", and verifySessionToken rejects any token
// that carries a `typ` at all — so neither direction can be replayed.
const COOKIE_NAME = "placement_erp_platform_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h, matches the JWT expiry

export async function createPlatformSession(platformAdminId: string) {
  const token = await signPlatformAdminToken(platformAdminId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function deletePlatformSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Unlike the tenant session, this re-reads the PlatformAdmin row on every
// request rather than trusting the token alone. There are very few of these
// accounts and they hold the highest privilege in the system, so deleting a
// row must revoke access immediately instead of waiting out a 12h token.
export const getPlatformSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyPlatformAdminToken(token);
  if (!payload) return null;

  const admin = await prisma.platformAdmin.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  if (!admin) return null;

  return admin;
});

export async function requirePlatformSession() {
  const admin = await getPlatformSession();
  if (!admin) {
    redirect("/platform/sign-in");
  }
  return admin;
}
