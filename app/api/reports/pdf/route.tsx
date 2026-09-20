import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { getActiveBatchId } from "@/lib/batch-context";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { getCollegeAnalytics } from "@/lib/analytics/stats";
import { PlacementSummaryPdf } from "@/lib/reports/placement-summary-pdf";

export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "report.export");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const activeBatchId = await getActiveBatchId();
  const [college, analytics] = await Promise.all([
    prisma.college.findUniqueOrThrow({ where: { id: session.collegeId }, select: { name: true } }),
    getCollegeAnalytics(db, activeBatchId),
  ]);

  const buffer = await renderToBuffer(
    <PlacementSummaryPdf collegeName={college.name} generatedAt={new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} a={analytics} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="placement-summary.pdf"` },
  });
}
