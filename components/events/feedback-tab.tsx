import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { deriveEventStatus } from "@/lib/events/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeedbackForm } from "@/components/events/feedback-form";

type FeedbackAnswers = {
  usefulness?: string;
  wouldAttendAnother?: boolean;
  suggestions?: string | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? "text-amber-500" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </div>
  );
}

// Feedback tab — students get a submission form once the event is COMPLETED
// and feedbackEnabled (or a read-only view of their own past response);
// TPO/staff with event.view_analytics get an aggregate + response list
// instead, respecting each response's `anonymous` flag.
export async function FeedbackTab({ eventId }: { eventId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [event, me, canViewAnalytics] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
    db.user.findUnique({ where: { id: session.userId }, select: { userType: true } }),
    hasPermission(session, "event.view_analytics"),
  ]);

  if (!event) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">Event not found.</CardContent>
      </Card>
    );
  }

  const status = deriveEventStatus(event);
  const isStudent = me?.userType === "STUDENT";

  if (isStudent) {
    // No collegeId column on EventFeedback — scoping already happened above
    // via the tenant-scoped Event lookup, same convention as EventRegistration.
    const existing = await db.eventFeedback.findUnique({ where: { eventId_userId: { eventId, userId: session.userId } } });

    if (existing) {
      const answers = (existing.answers ?? {}) as FeedbackAnswers;
      return (
        <Card>
          <CardHeader>
            <CardTitle>Your feedback</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Stars rating={existing.rating} />
            <div>
              <span className="text-muted-foreground">How useful was the session? </span>
              {answers.usefulness || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Would attend another? </span>
              {answers.wouldAttendAnother ? "Yes" : "No"}
            </div>
            {answers.suggestions && (
              <div>
                <span className="text-muted-foreground">Suggestions: </span>
                {answers.suggestions}
              </div>
            )}
            {existing.anonymous && <Badge variant="outline">Submitted anonymously</Badge>}
            <p className="text-muted-foreground text-xs">
              Submitted {existing.submittedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </CardContent>
        </Card>
      );
    }

    if (status !== "COMPLETED") {
      return (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            Feedback opens once the event is completed.
          </CardContent>
        </Card>
      );
    }

    if (!event.feedbackEnabled) {
      return (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            Feedback isn&apos;t enabled for this event.
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Share your feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <FeedbackForm eventId={eventId} />
        </CardContent>
      </Card>
    );
  }

  if (canViewAnalytics) {
    const responses = await db.eventFeedback.findMany({
      where: { eventId },
      include: { user: { select: { name: true } } },
      orderBy: { submittedAt: "desc" },
    });
    const avgRating = responses.length > 0 ? responses.reduce((sum, r) => sum + r.rating, 0) / responses.length : null;

    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Feedback summary</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-8 text-sm">
            <div>
              <div className="text-2xl font-semibold">{avgRating !== null ? avgRating.toFixed(1) : "—"}</div>
              <div className="text-muted-foreground">Average rating</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{responses.length}</div>
              <div className="text-muted-foreground">Responses</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Responses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {responses.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">No responses yet.</p>
            )}
            {responses.map((r) => {
              const answers = (r.answers ?? {}) as FeedbackAnswers;
              return (
                <div key={r.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.anonymous ? "Anonymous" : r.user.name}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <div className="text-muted-foreground">{answers.usefulness}</div>
                  <div className="text-muted-foreground text-xs">
                    Would attend another: {answers.wouldAttendAnother ? "Yes" : "No"}
                    {answers.suggestions ? ` · Suggestions: ${answers.suggestions}` : ""}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {r.submittedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="text-muted-foreground py-6 text-center text-sm">
        Feedback isn&apos;t available to you here.
      </CardContent>
    </Card>
  );
}
