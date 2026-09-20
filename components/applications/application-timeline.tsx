import { Card, CardContent } from "@/components/ui/card";

type Entry = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorName: string;
  createdAt: string;
};

function labelize(status: string) {
  return status.toLowerCase().split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export function ApplicationTimeline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <Card><CardContent className="text-muted-foreground py-8 text-center text-sm">No status changes recorded yet.</CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col divide-y pt-6">
        {[...entries].reverse().map((e) => (
          <div key={e.id} className="flex items-start gap-3 py-3">
            <div className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
            <div className="flex-1 text-sm">
              <p className="font-medium">
                {e.fromStatus ? `${labelize(e.fromStatus)} → ${labelize(e.toStatus)}` : `Application ${labelize(e.toStatus).toLowerCase()}`}
              </p>
              {e.reason && <p className="text-muted-foreground text-xs">{e.reason}</p>}
              <p className="text-muted-foreground text-xs">
                {new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {e.actorName}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
