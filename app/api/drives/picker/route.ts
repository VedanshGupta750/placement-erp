import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

// Backs the Create Drive dropdown's "Duplicate Existing Drive" and "Create
// From Template" pickers — same underlying /api/drives/[id]/duplicate
// action either way, this just controls which drives populate the list.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "drive.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const templatesOnly = new URL(request.url).searchParams.get("templates") === "1";

  const drives = await db.drive.findMany({
    where: templatesOnly ? { isTemplate: true } : undefined,
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    drives: drives.map((d: { id: string; title: string; company: { name: string }; isTemplate: boolean }) => ({
      id: d.id,
      title: d.title,
      companyName: d.company.name,
      isTemplate: d.isTemplate,
    })),
  });
}
