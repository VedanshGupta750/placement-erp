import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardGrid } from "@/components/network/card-grid";

type Alumnus = { studentId: string; name: string; courseLabel: string; batchYear: number; companyName: string; positionTitle: string | null; package: string };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function AlumniTab({ alumni }: { alumni: Alumnus[] }) {
  if (alumni.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No alumni on record yet — this list is built from students in past batches who have a confirmed joined offer, so it fills in as more batches graduate and confirm joining.
      </p>
    );
  }
  return (
    <CardGrid>
      {alumni.map((a) => (
        <Card key={a.studentId} className="min-w-0">
          <CardContent className="flex min-w-0 items-start gap-3 pt-6">
            <Avatar className="ring-border size-10 shrink-0 ring-1"><AvatarFallback className="bg-accent text-accent-foreground text-sm">{initials(a.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.name}</div>
              <div className="text-muted-foreground line-clamp-2 break-words text-xs">{a.positionTitle ?? "—"} · {a.companyName}</div>
              <div className="text-muted-foreground line-clamp-2 break-words text-xs">Batch {a.batchYear} · {a.courseLabel}</div>
              <div className="text-muted-foreground text-xs">{a.package}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </CardGrid>
  );
}
