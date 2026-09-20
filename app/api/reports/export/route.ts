import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { getCollegeAnalytics } from "@/lib/analytics/stats";

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "report.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const type = new URL(request.url).searchParams.get("type") ?? "course";
  const activeBatchId = await getActiveBatchId();
  const a = await getCollegeAnalytics(db, activeBatchId);

  let headers: string[];
  let rows: (string | number)[][];
  if (type === "department") {
    headers = ["Department", "Total", "Placed", "Placement %"];
    rows = a.departmentRows.map((r) => [r.name, r.total, r.placed, r.pct.toFixed(1)]);
  } else if (type === "company") {
    headers = ["Company", "Drives Run", "Offers Made", "Students Placed", "Avg Package"];
    rows = a.companyRows.map((r) => [r.name, r.drives, r.offers, r.placed, (r.avgPackage / 100000).toFixed(1)]);
  } else {
    headers = ["Course", "Total", "Placed", "Placement %", "Offers", "Avg Package"];
    rows = a.courseRows.map((r) => [r.name, r.total, r.placed, r.pct.toFixed(1), r.offers, (r.avgPackage / 100000).toFixed(1)]);
  }

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${type}-report.csv"` },
  });
}
