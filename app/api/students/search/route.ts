import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";

// Lightweight typeahead for pickers (Add Application dialog) — not the
// full Students list query, just id/name/enrollment for a short dropdown.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ students: [] });

  const scopeWhere = await getStudentScopeWhere(db, session);
  const students = await db.student.findMany({
    where: {
      AND: [
        scopeWhere,
        { OR: [{ user: { name: { contains: q, mode: "insensitive" } } }, { enrollmentNumber: { contains: q, mode: "insensitive" } }] },
      ],
    },
    include: { user: { select: { name: true } } },
    take: 10,
  });

  return NextResponse.json({
    students: students.map((s: { id: string; enrollmentNumber: string; user: { name: string } }) => ({ id: s.id, name: s.user.name, enrollmentNumber: s.enrollmentNumber })),
  });
}
