import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Looks up internal users (staff/students with accounts) to start a new
// conversation or add to a group. Recruiter Contacts are NOT searchable
// here — they can't log in and can never be real chat participants.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "message.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ people: [] });

  const people = await db.user.findMany({
    where: { name: { contains: q, mode: "insensitive" }, id: { not: session.userId } },
    select: { id: true, name: true, email: true, userType: true },
    take: 10,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ people });
}
