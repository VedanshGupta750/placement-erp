import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";

// Candidate list for the bulk "Assign coordinator" action — anyone with a
// DepartmentMembership row (Head/Coordinator/Lead Coordinator/Volunteer)
// is a plausible coordinator to assign; not permission-gated beyond normal
// session auth since it's just a picker list, not a mutation.
export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const memberships = await db.departmentMembership.findMany({
    where: { user: { collegeId: session.collegeId } },
    include: { user: { select: { id: true, name: true, email: true } }, department: { select: { name: true } } },
    distinct: ["userId"],
    orderBy: { user: { name: "asc" } },
  });

  const coordinators = memberships.map((m: { user: { id: string; name: string; email: string }; title: string; department: { name: string } }) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    title: m.title,
    departmentName: m.department.name,
  }));

  return NextResponse.json({ coordinators });
}
