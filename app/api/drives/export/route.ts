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
    await requirePermission(session, "drive.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const ids = new URL(request.url).searchParams.get("ids");
  const driveIds = ids ? ids.split(",").filter(Boolean) : null;

  const drives = await db.drive.findMany({
    where: driveIds ? { id: { in: driveIds } } : undefined,
    include: { company: true, positions: true, _count: { select: { applications: true, offers: true } } },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Company", "Drive", "Status", "Position Type", "Drive Type", "Registration Closes", "CTC Min", "CTC Max", "Openings", "Eligible", "Applied", "Shortlisted", "Offers"];
  const rows = drives.map((d) => {
    const pos = d.positions[0];
    return [
      d.company.name,
      d.title,
      d.status,
      pos?.positionType ?? "",
      d.driveTypeLabel,
      d.registrationClosesAt ? d.registrationClosesAt.toISOString() : "",
      pos?.minCtc ? Number(pos.minCtc) : "",
      pos?.maxCtc ? Number(pos.maxCtc) : "",
      d.expectedOpenings ?? "",
      d.eligibleCount,
      d._count.applications,
      d.shortlistedCount,
      d._count.offers,
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="drives.csv"`,
    },
  });
}
