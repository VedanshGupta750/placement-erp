import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RESULT_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  PASSED: "Passed",
  FAILED: "Not selected",
  NO_SHOW: "No show",
  WITHDRAWN: "Withdrawn",
};

const RESULT_CLASSES: Record<string, string> = {
  PASSED: "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  FAILED: "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  NO_SHOW: "border-none bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export async function InterviewsTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const rounds = await db.roundCandidate.findMany({
    where: { studentId },
    include: { round: { include: { drive: { include: { company: true } } } } },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <Card>
      <CardContent className="flex flex-col divide-y pt-6">
        {rounds.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No interview rounds yet.</p>}
        {rounds.map((r: {
          id: string;
          status: string;
          mode: string;
          scheduledAt: Date | null;
          venue: string | null;
          meetingUrl: string | null;
          interviewerName: string | null;
          score: number | null;
          feedback: string | null;
          round: { name: string; roundType: string; drive: { company: { name: string } } };
        }) => (
          <div key={r.id} className="flex flex-col gap-1.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{r.round.drive.company.name} — {r.round.name}</div>
                <div className="text-muted-foreground text-xs">{r.round.roundType} · {r.mode}</div>
              </div>
              <Badge className={RESULT_CLASSES[r.status] ?? "border-none bg-muted text-muted-foreground"}>
                {RESULT_LABEL[r.status] ?? r.status}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
              {r.scheduledAt && <span>{r.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>}
              {r.interviewerName && <span>Interviewer: {r.interviewerName}</span>}
              {r.venue && <span>Venue: {r.venue}</span>}
              {r.score != null && <span>Score: {r.score}</span>}
            </div>
            {r.feedback && <p className="text-muted-foreground text-xs">{r.feedback}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
