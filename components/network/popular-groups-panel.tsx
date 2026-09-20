import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NetworkGroup } from "@/lib/network/groups";

export function PopularGroupsPanel({ groups }: { groups: NetworkGroup[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="min-w-0 truncate text-base">Popular groups</CardTitle>
        <Link href="/network?tab=groups" className="text-primary shrink-0 text-xs font-medium hover:underline">View All</Link>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {groups.map((g) => (
          <Link key={g.id} href={g.href} className="hover:bg-accent/40 flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium break-words">{g.label}</div>
              <div className="text-muted-foreground break-words text-xs">{g.sublabel}</div>
            </div>
            <span className="text-muted-foreground shrink-0 tabular-nums">{g.count}</span>
          </Link>
        ))}
        {groups.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No groups yet.</p>}
      </CardContent>
    </Card>
  );
}
