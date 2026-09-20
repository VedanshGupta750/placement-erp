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
    await requirePermission(session, "offer.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const ids = new URL(request.url).searchParams.get("ids");
  const offerIds = ids ? ids.split(",").filter(Boolean) : null;

  const offers = await db.offer.findMany({
    where: offerIds ? { id: { in: offerIds } } : undefined,
    include: {
      student: { include: { user: true, course: true, department: true } },
      drive: { include: { company: true } },
      position: true,
    },
    orderBy: { createdAt: "desc" },
    take: offerIds ? undefined : 2000,
  });

  const headers = ["Enrollment No.", "Student", "Email", "Course", "Department", "Company", "Drive", "Offer Type", "Total CTC", "Fixed", "Offer Date", "Joining Date", "Status"];
  const rows = offers.map((o) => [
    o.student.enrollmentNumber,
    o.student.user.name,
    o.student.user.email,
    o.student.course.specialization ?? o.student.course.name,
    o.student.department?.name ?? "",
    o.drive.company.name,
    o.drive.title,
    o.offerType,
    o.totalCompensation.toString(),
    o.fixedCompensation?.toString() ?? "",
    o.offerDate ? o.offerDate.toISOString() : "",
    o.joiningDate ? o.joiningDate.toISOString() : "",
    o.status,
  ]);

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="offers.csv"`,
    },
  });
}
