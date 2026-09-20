import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUDIT_LABELS } from "@/lib/audit";

type Entry = { id: string; action: string; createdAt: string; actorName: string | null };

export function InterviewActivityPanel({ entries }: { entries: Entry[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <Link href="/audit?type=RoundCandidate" className="text-primary text-xs font-medium hover:underline">View All</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.map((e) => (
          <div key={e.id} className="text-sm">
            <div>{AUDIT_LABELS[e.action] ?? e.action}{e.actorName ? ` — ${e.actorName}` : ""}</div>
            <div className="text-muted-foreground text-xs">{new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-muted-foreground text-sm">No recent activity.</p>}
      </CardContent>
    </Card>
  );
}
