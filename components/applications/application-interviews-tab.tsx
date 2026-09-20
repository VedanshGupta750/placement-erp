import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

type Round = {
  id: string;
  roundName: string;
  roundType: string;
  status: string;
  mode: string;
  scheduledAt: string | null;
  venue: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
  score: number | null;
  feedback: string | null;
};

export function ApplicationInterviewsTab({ rounds }: { rounds: Round[] }) {
  if (rounds.length === 0) {
    return (
      <Card><CardContent className="text-muted-foreground py-8 text-center text-sm">Not assigned to any interview round yet.</CardContent></Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rounds.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-col gap-2 pt-6 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.roundName} <span className="text-muted-foreground font-normal">({r.roundType})</span></span>
              <StatusBadge status={r.status} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <div><span className="text-muted-foreground">Mode: </span>{r.mode.replaceAll("_", " ")}</div>
              {r.scheduledAt && <div><span className="text-muted-foreground">When: </span>{new Date(r.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>}
              {r.interviewerName && <div><span className="text-muted-foreground">Interviewer: </span>{r.interviewerName}</div>}
              {r.venue && <div><span className="text-muted-foreground">Venue: </span>{r.venue}</div>}
              {r.meetingUrl && <div><a href={r.meetingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Meeting link</a></div>}
              {r.score != null && <div><span className="text-muted-foreground">Score: </span>{r.score}</div>}
            </div>
            {r.feedback && <p className="text-muted-foreground border-t pt-2 text-xs">{r.feedback}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
