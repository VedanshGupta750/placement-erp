import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "application.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const ids = new URL(request.url).searchParams.get("ids");
  const applicationIds = ids ? ids.split(",").filter(Boolean) : null;

  const applications = await db.application.findMany({
    where: applicationIds ? { id: { in: applicationIds } } : undefined,
    include: {
      student: { include: { user: true, course: true } },
      drive: { include: { company: true } },
      position: true,
    },
    orderBy: { appliedAt: "desc" },
    take: applicationIds ? undefined : 2000,
  });

  const headers = ["Enrollment No.", "Student", "Email", "Course", "Live Backlogs", "Company", "Drive", "Position", "Match %", "Applied On", "Status"];
  const rows = applications.map((a) => [
    a.student.enrollmentNumber,
    a.student.user.name,
    a.student.user.email,
    a.student.course.specialization ?? a.student.course.name,
    a.student.liveBacklogs,
    a.drive.company.name,
    a.drive.title,
    a.position.title,
    a.matchScore ?? "",
    a.appliedAt.toISOString(),
    a.status,
  ]);

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="applications.csv"`,
    },
  });
}
