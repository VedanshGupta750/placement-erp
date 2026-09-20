import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { deriveEventStatus } from "@/lib/events/status";

// Feedback tab's student submission form posts here. Upserts one
// EventFeedback row per (event, user) — resubmitting overwrites the
// previous response rather than creating a duplicate.
const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  usefulness: z.string().trim().min(1, "Please share how useful the session was."),
  wouldAttendAnother: z.boolean(),
  suggestions: z.string().trim().optional(),
  anonymous: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: eventId } = await params;
  const db = getTenantDb(session.collegeId);

  // Tenant-scoped lookup confirms this event belongs to the caller's
  // college before we touch EventFeedback, which has no collegeId column
  // and is scoped by hand via the parent event (see scoped-db.ts).
  const [event, me] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
    db.user.findUnique({ where: { id: session.userId }, select: { userType: true } }),
  ]);
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (me?.userType !== "STUDENT") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!event.feedbackEnabled) return NextResponse.json({ error: "feedback_disabled" }, { status: 403 });

  const status = deriveEventStatus(event);
  if (status !== "COMPLETED") {
    return NextResponse.json({ error: "event_not_completed" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { rating, usefulness, wouldAttendAnother, suggestions, anonymous } = parsed.data;
  const answers = { usefulness, wouldAttendAnother, suggestions: suggestions || null };

  const feedback = await db.eventFeedback.upsert({
    where: { eventId_userId: { eventId, userId: session.userId } },
    create: { eventId, userId: session.userId, rating, answers, anonymous },
    update: { rating, answers, anonymous },
  });

  return NextResponse.json({ ok: true, feedback });
}
