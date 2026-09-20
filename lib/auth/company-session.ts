import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signCompanySessionToken, verifyCompanySessionToken } from "@/lib/auth/jwt";

const COOKIE_NAME = "placement_erp_company_session";

export async function createCompanySession(payload: { companyUserId: string; companyId: string }) {
  const token = await signCompanySessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function deleteCompanySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const getCompanySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyCompanySessionToken(token);
  if (!payload) return null;
  return { companyUserId: payload.sub, companyId: payload.companyId };
});

export async function requireCompanySession() {
  const session = await getCompanySession();
  if (!session) {
    redirect("/employer/sign-in");
  }
  return session;
}
