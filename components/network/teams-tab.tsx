import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { NetworkTeam } from "@/lib/network/teams";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function TeamsTab({ teams }: { teams: NetworkTeam[] }) {
  if (teams.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">No department teams set up yet.</p>;
  }
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @min-[40rem]:grid-cols-2">
      {teams.map((team) => (
        <Card key={team.key} className="min-w-0">
          <CardHeader><CardTitle className="text-base break-words">{team.label} ({team.members.length})</CardTitle></CardHeader>
          <CardContent className="flex min-w-0 flex-col divide-y">
            {team.members.map((m) => (
              <div key={m.id} className="flex min-w-0 items-center gap-3 py-2 text-sm">
                <Avatar className="ring-border size-8 shrink-0 ring-1"><AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials(m.name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium" title={m.name}>{m.name}</div>
                  <div className="text-muted-foreground truncate text-xs" title={`${m.designation} · ${m.departmentName}`}>{m.designation} · {m.departmentName}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}
