import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";

const COOKIE_NAME = "active_batch_id";

// Sets the "currently selected batch" the TPO console soft-scopes lists to
// (Students, Drives) when no explicit filter is given — mirrors the
// top-left batch switcher pattern from the POD teardown. Purely a UX
// convenience cookie, not a security boundary: every list still enforces
// real tenant (collegeId) scoping via getTenantDb regardless of this value.
export async function POST(request: Request) {
  await requireSession();
  const body = await request.json().catch(() => null);
  const batchId = typeof body?.batchId === "string" ? body.batchId : null;

  const cookieStore = await cookies();
  if (batchId) {
    cookieStore.set(COOKIE_NAME, batchId, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  } else {
    cookieStore.delete(COOKIE_NAME);
  }
  return NextResponse.json({ ok: true });
}
