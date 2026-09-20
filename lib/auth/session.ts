import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSessionToken, verifySessionToken, type SessionPayload } from "@/lib/auth/jwt";

const COOKIE_NAME = "placement_erp_session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day, matches JWT default expiry
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createSession(payload: {
  userId: string;
  collegeId: string;
  roleId: string | null;
  rememberMe?: boolean;
}) {
  const maxAge = payload.rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : DEFAULT_MAX_AGE_SECONDS;
  const token = await signSessionToken(
    {
      sub: payload.userId,
      collegeId: payload.collegeId,
      roleId: payload.roleId,
    },
    payload.rememberMe ? "30d" : "1d",
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

async function readSessionCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// DAL entry point: verifies the session and returns { userId, collegeId, roleId }.
// Memoized per request via React's cache() so calling it repeatedly in one
// render pass / route handler doesn't re-verify the JWT each time.
export const getSession = cache(async () => {
  const session = await readSessionCookie();
  if (!session) return null;
  return {
    userId: session.sub,
    collegeId: session.collegeId,
    roleId: session.roleId,
  };
});

// Use in Server Components / route handlers that require an authenticated
// user. Redirects to /sign-in rather than returning null.
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}
