import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { runStudentAiQuery } from "@/lib/students/ai-query";
import { getStudentScopeWhere } from "@/lib/students/scope";

export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "validation_error", message: "Ask a question first." }, { status: 400 });
  }
  if (query.length > 400) {
    return NextResponse.json({ error: "validation_error", message: "Keep the question under 400 characters." }, { status: 400 });
  }

  const result = await runStudentAiQuery(db, session.collegeId, query);

  // A Department Coordinator's row-level scope applies here too — the AI
  // never sees or returns students outside it.
  const scopeWhere = await getStudentScopeWhere(db, session);
  if (Object.keys(scopeWhere).length > 0) {
    const scoped = await db.student.findMany({ where: { id: { in: result.matchedIds }, ...scopeWhere }, select: { id: true } });
    const allowedIds = new Set(scoped.map((s: { id: string }) => s.id));
    result.students = result.students.filter((s) => allowedIds.has(s.id));
    result.matchedIds = result.matchedIds.filter((id) => allowedIds.has(id));
  }

  return NextResponse.json(result);
}
