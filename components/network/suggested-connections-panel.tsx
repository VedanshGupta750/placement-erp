import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageUserDialog } from "@/components/network/message-user-dialog";

type Suggestion = { userId: string; name: string; courseLabel: string; reason: string };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function SuggestedConnectionsPanel({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">People you may know</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {suggestions.map((s) => (
          <div key={s.userId} className="flex min-w-0 items-center gap-3">
            <Avatar className="ring-border size-9 shrink-0 ring-1"><AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials(s.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{s.name}</div>
              <div className="text-muted-foreground truncate text-xs">{s.courseLabel} · {s.reason}</div>
            </div>
            <MessageUserDialog userId={s.userId} userName={s.name} triggerClassName="shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
