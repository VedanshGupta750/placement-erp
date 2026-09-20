import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardGrid } from "@/components/network/card-grid";

type Recruiter = { id: string; name: string; designation: string | null; companyName: string | null; relationshipStage: string };

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

// Recruiters already live in the Contacts CRM (lib/validators/contact.ts
// CONTACT_TYPES — Campus Recruiter, Talent Acquisition, etc.) — this tab
// surfaces them from there rather than building a second, parallel
// recruiter model just for Network.
export function RecruitersTab({ recruiters }: { recruiters: Recruiter[] }) {
  if (recruiters.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">No recruiter contacts yet — add them from Contacts.</p>;
  }
  return (
    <CardGrid>
      {recruiters.map((r) => (
        <Link key={r.id} href={`/contacts/${r.id}`}>
          <Card className="min-w-0 transition-colors hover:bg-accent/40">
            <CardContent className="flex min-w-0 items-start gap-3 pt-6">
              <Avatar className="ring-border size-10 shrink-0 ring-1"><AvatarFallback className="bg-accent text-accent-foreground text-sm">{initials(r.name)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-muted-foreground truncate text-xs">{r.designation ?? "—"}{r.companyName ? ` · ${r.companyName}` : ""}</div>
                <Badge variant="outline" className="mt-1 text-[10px]">{r.relationshipStage}</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </CardGrid>
  );
}
