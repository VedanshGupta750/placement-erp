import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/audit";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid ambiguity when handwritten/typed

function generateCode() {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
}

// Finds every EventAttendance row for this event with checkInAt set (i.e.
// present) that doesn't already have a matching EventCertificate, and issues
// one each. Idempotent — safe to call repeatedly as more attendees check in.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "event.manage_registrations");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!event.certificateEnabled) {
    return NextResponse.json({ error: "validation_error", message: "Certificates aren't enabled for this event." }, { status: 400 });
  }

  const [presentAttendance, existingCertificates] = await Promise.all([
    db.eventAttendance.findMany({ where: { eventId, checkInAt: { not: null } }, select: { userId: true } }),
    db.eventCertificate.findMany({ where: { eventId }, select: { userId: true } }),
  ]);

  const alreadyIssued = new Set(existingCertificates.map((c) => c.userId));
  const pendingUserIds = presentAttendance.map((a) => a.userId).filter((userId) => !alreadyIssued.has(userId));

  let count = 0;
  for (const userId of pendingUserIds) {
    let attempt = 0;
    // Retry on the rare unique-constraint collision on `code`.
    for (;;) {
      attempt += 1;
      try {
        await db.eventCertificate.create({
          data: { eventId, userId, code: generateCode(), issuedById: session.userId },
        });
        count += 1;
        break;
      } catch (err) {
        if (attempt < 5) continue;
        throw err;
      }
    }
  }

  if (count > 0) {
    await recordAudit(db, {
      collegeId: session.collegeId,
      actorId: session.userId,
      action: "event.certificates_generated",
      resourceType: "Event",
      resourceId: eventId,
      after: { count },
    });
  }

  return NextResponse.json({ ok: true, count });
}
