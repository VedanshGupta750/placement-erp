import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Candidate list for the bulk "Assign Owner" action. Unlike
// /api/students/coordinators (name/title/department only), this returns
// staff email addresses too — gated on drive.edit (the same permission the
// assign_owner action itself requires) rather than left open to any
// session, so a student account can't harvest the placement team's email
// list.
export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const staff = await db.user.findMany({
    where: { userType: "PLACEMENT_TEAM" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ staff });
}
