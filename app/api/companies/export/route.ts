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
    await requirePermission(session, "company.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const ids = new URL(request.url).searchParams.get("ids");
  const companyIds = ids ? ids.split(",").filter(Boolean) : null;

  const partnerships = await db.collegePartnership.findMany({
    where: companyIds ? { companyId: { in: companyIds } } : undefined,
    include: {
      company: {
        include: { drives: { where: { collegeId: session.collegeId }, include: { _count: { select: { applications: true, offers: true } } } } },
      },
    },
    orderBy: { connectedAt: "desc" },
  });

  const headers = ["Company", "Industry", "Status", "Drives", "Applications", "Offers", "Website", "HQ"];
  const rows = partnerships.map((p) => {
    const drives = p.company.drives;
    return [
      p.company.name,
      p.company.industryType ?? "",
      p.status,
      drives.length,
      drives.reduce((s: number, d: { _count: { applications: number } }) => s + d._count.applications, 0),
      drives.reduce((s: number, d: { _count: { offers: number } }) => s + d._count.offers, 0),
      p.company.website ?? "",
      p.company.headquarters ?? "",
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="companies.csv"`,
    },
  });
}
