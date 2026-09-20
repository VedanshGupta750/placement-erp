import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Staff search for the interviewer picker in the schedule dialog. Any
// non-student staff account can be linked as an interviewer (Faculty
// commonly run technical rounds, not just Placement Team) — gated on
// interview.schedule so a student can't harvest the staff directory.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "interview.schedule");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ staff: [] });

  const staff = await db.user.findMany({
    where: { userType: { not: "STUDENT" }, name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, email: true, userType: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ staff });
}
