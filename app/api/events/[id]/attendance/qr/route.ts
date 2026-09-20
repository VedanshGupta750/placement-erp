import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.mark_attendance");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Built from NEXT_PUBLIC_APP_URL rather than request.url's origin —
  // behind Railway's reverse proxy, request.url reflects the internal
  // localhost socket the Node process is bound to, not the public host,
  // which would otherwise encode an unreachable localhost URL into the QR
  // code students actually scan.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const checkinUrl = `${origin}/events/${eventId}/checkin`;
  const dataUrl = await QRCode.toDataURL(checkinUrl);

  return NextResponse.json({ dataUrl, checkinUrl });
}
