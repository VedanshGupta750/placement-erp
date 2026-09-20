import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { getStudentScopeWhere } from "@/lib/students/scope";

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Respects either an explicit `ids` list (bulk-selected rows from the list
// page) or the same filter query params the list page itself uses, so
// "Export selected" and "Export CSV" (with active filters) both produce
// exactly what's currently on screen rather than always exporting everyone.
export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "student.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids");

  const where: Record<string, unknown> = {};
  if (ids) {
    where.id = { in: ids.split(",").filter(Boolean) };
  } else {
    const q = searchParams.get("q");
    if (q) {
      where.OR = [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { enrollmentNumber: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (searchParams.get("courseId")) where.courseId = searchParams.get("courseId");
    if (searchParams.get("batchId")) where.batchId = searchParams.get("batchId");
    if (searchParams.get("departmentId")) where.departmentId = searchParams.get("departmentId");
    if (searchParams.get("placementStatus")) where.placementStatus = searchParams.get("placementStatus");
    const minCgpa = searchParams.get("minCgpa");
    const maxCgpa = searchParams.get("maxCgpa");
    if (minCgpa || maxCgpa) {
      where.aggregate = { ...(minCgpa ? { gte: Number(minCgpa) } : {}), ...(maxCgpa ? { lte: Number(maxCgpa) } : {}) };
    }
    const minTenth = searchParams.get("minTenth");
    const maxTenth = searchParams.get("maxTenth");
    if (minTenth || maxTenth) {
      where.tenthScore = { ...(minTenth ? { gte: Number(minTenth) } : {}), ...(maxTenth ? { lte: Number(maxTenth) } : {}) };
    }
    const minTwelfth = searchParams.get("minTwelfth");
    const maxTwelfth = searchParams.get("maxTwelfth");
    if (minTwelfth || maxTwelfth) {
      where.twelfthScore = { ...(minTwelfth ? { gte: Number(minTwelfth) } : {}), ...(maxTwelfth ? { lte: Number(maxTwelfth) } : {}) };
    }
    const minDiploma = searchParams.get("minDiploma");
    const maxDiploma = searchParams.get("maxDiploma");
    if (minDiploma || maxDiploma) {
      where.diplomaScore = { ...(minDiploma ? { gte: Number(minDiploma) } : {}), ...(maxDiploma ? { lte: Number(maxDiploma) } : {}) };
    }
    if (searchParams.get("maxBacklogs")) where.liveBacklogs = { lte: Number(searchParams.get("maxBacklogs")) };
    if (searchParams.get("hasBacklogs") === "1") where.liveBacklogs = { gt: 0 };
    if (searchParams.get("hasHistoricalBacklogs") === "1") where.closedBacklogs = { gt: 0 };
    if (searchParams.get("eligible") === "1") where.eligibleForPlacements = true;
    if (searchParams.get("interestedJobs") === "1") where.interestedInJobs = true;
    if (searchParams.get("interestedInternships") === "1") where.interestedInInternships = true;
  }

  const scopeWhere = await getStudentScopeWhere(db, session);
  const students = await db.student.findMany({
    where: { AND: [scopeWhere, where] },
    include: { user: true, course: true, batch: true, offers: { select: { status: true } } },
    orderBy: { enrollmentNumber: "asc" },
  });

  const headers = ["Enrollment Number", "Name", "Email", "Course", "Batch", "CGPA", "Live Backlogs", "Eligible", "Placed"];
  const rows = students.map((s) => [
    s.enrollmentNumber,
    s.user.name,
    s.user.email,
    s.course.specialization ?? s.course.name,
    s.batch.year,
    s.aggregate ?? "",
    s.liveBacklogs,
    s.eligibleForPlacements ? "Yes" : "No",
    s.offers.some((o) => ["ACCEPTED", "JOINING_PENDING", "JOINED"].includes(o.status)) ? "Yes" : "No",
  ]);

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="students-batch-export.csv"`,
    },
  });
}
