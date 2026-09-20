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
    await requirePermission(session, "interview.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const ids = new URL(request.url).searchParams.get("ids");
  const candidateIds = ids ? ids.split(",").filter(Boolean) : null;

  const candidates = await db.roundCandidate.findMany({
    where: candidateIds ? { id: { in: candidateIds } } : undefined,
    include: {
      student: { include: { user: true } },
      round: { include: { drive: { include: { company: true } } } },
    },
    orderBy: { scheduledAt: "desc" },
    take: candidateIds ? undefined : 2000,
  });

  const headers = ["Enrollment No.", "Student", "Company", "Drive", "Round", "Round Type", "Scheduled", "Mode", "Interviewer", "Status", "Score", "Result"];
  const rows = candidates.map((c) => [
    c.student.enrollmentNumber,
    c.student.user.name,
    c.round.drive.company.name,
    c.round.drive.title,
    c.round.name,
    c.round.roundType,
    c.scheduledAt ? c.scheduledAt.toISOString() : "",
    c.mode,
    c.interviewerName ?? "",
    c.status,
    c.score ?? "",
    ["PASSED", "FAILED", "NO_SHOW"].includes(c.status) ? c.status : "",
  ]);

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="interviews.csv"`,
    },
  });
}
