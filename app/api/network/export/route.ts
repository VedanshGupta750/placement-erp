import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getPlacementStatusByStudentId } from "@/lib/network/placement-status";

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // The Network page hid the Export button from Student sessions, but that
  // alone doesn't stop someone from hitting this URL directly — without
  // this check, any student could bulk-download every member's email in
  // one request, completely bypassing the per-profile visibility gating
  // in /api/network/members/[userId]. Same class of gap as the missing
  // page-level gates found earlier this session, just on an API route
  // instead of a page.
  const caller = await db.user.findUnique({ where: { id: session.userId }, select: { userType: true } });
  if (caller?.userType === "STUDENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const ids = url.searchParams.get("ids");
  const userIds = ids ? ids.split(",").filter(Boolean) : null;

  const q = url.searchParams.get("q");
  const userType = url.searchParams.get("userType");
  const courseId = url.searchParams.get("courseId");
  const batchId = url.searchParams.get("batchId");
  const departmentId = url.searchParams.get("departmentId");

  const where: Record<string, unknown> = userIds ? { id: { in: userIds } } : { status: "ACTIVE" };
  if (!userIds) {
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (userType) where.userType = userType;
    if (courseId || batchId || departmentId) {
      where.studentProfile = {
        ...(courseId ? { courseId } : {}),
        ...(batchId ? { batchId } : {}),
        ...(departmentId ? { departmentId } : {}),
      };
    }
  }

  const members = await db.user.findMany({
    where,
    include: { studentProfile: { include: { course: true, batch: true, department: true } } },
    orderBy: { name: "asc" },
    take: 2000,
  });

  const studentIds = members.filter((m) => m.studentProfile).map((m) => m.studentProfile!.id);
  const placementByStudent = await getPlacementStatusByStudentId(db, studentIds);

  const headers = ["Name", "Email", "Type", "Department", "Course", "Batch", "Placement Status"];
  const rows = members.map((m) => {
    const status = m.studentProfile ? placementByStudent.get(m.studentProfile.id) : null;
    const statusLabel = status
      ? status.kind === "placed" ? `Placed — ${status.companyName}` : status.kind === "in_process" ? "In Process" : status.kind === "not_eligible" ? "Not Eligible" : "Eligible"
      : "";
    return [
      m.name,
      m.email,
      m.userType,
      m.studentProfile?.department?.name ?? "",
      m.studentProfile ? (m.studentProfile.course.specialization ?? m.studentProfile.course.name) : "",
      m.studentProfile?.batch.year ?? "",
      statusLabel,
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="network.csv"` },
  });
}
