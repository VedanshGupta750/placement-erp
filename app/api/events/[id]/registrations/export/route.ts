import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.manage_registrations");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const registrations = await db.eventRegistration.findMany({
    where: { eventId },
    include: { user: { include: { studentProfile: { include: { course: true, batch: true } } } } },
    orderBy: { registeredAt: "desc" },
  });

  const headers = ["Student", "Branch", "Year", "Status", "RegisteredAt"];
  const rows = registrations.map((r) => [
    r.user.name,
    r.user.studentProfile?.course ? (r.user.studentProfile.course.specialization ?? r.user.studentProfile.course.name) : "",
    r.user.studentProfile?.batch?.year ?? "",
    r.status,
    r.registeredAt.toISOString(),
  ]);

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="event-${eventId}-registrations.csv"`,
    },
  });
}
