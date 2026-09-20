import { Card, CardContent } from "@/components/ui/card";

type Entry = { label: string; at: string };

// Unlike ApplicationStatusHistory, Offer has no dedicated history table —
// its lifecycle is a fixed sequence of nullable timestamp columns
// (issuedAt/acceptedAt/declinedAt/withdrawnAt) plus JoiningRecord. That's
// honestly enough to build a real timeline from without inventing a new
// model just for this.
export function OfferTimeline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return <Card><CardContent className="text-muted-foreground py-8 text-center text-sm">No activity recorded yet.</CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
            <div className="text-sm">
              <div className="font-medium">{e.label}</div>
              <div className="text-muted-foreground text-xs">{new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
