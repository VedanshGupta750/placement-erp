import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Flag = { applicationId: string; studentName: string; driveTitle: string; companyName: string; detail: string };

const GROUPS: { key: "stalled" | "strongMatchRejected" | "shortlistedNoInterview"; label: string }[] = [
  { key: "stalled", label: "Stalled 14+ days" },
  { key: "strongMatchRejected", label: "Strong match, rejected" },
  { key: "shortlistedNoInterview", label: "Shortlisted, no interview" },
];

export function ApplicationFlagsPanel({
  flags,
}: {
  flags: Record<"stalled" | "strongMatchRejected" | "shortlistedNoInterview", Flag[]>;
}) {
  const total = GROUPS.reduce((s, g) => s + flags[g.key].length, 0);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-500" /> Smart alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {GROUPS.filter((g) => flags[g.key].length > 0).map((g) => (
          <div key={g.key}>
            <div className="text-muted-foreground mb-1 text-xs font-medium">{g.label} ({flags[g.key].length})</div>
            <div className="flex flex-col gap-1">
              {flags[g.key].slice(0, 5).map((f) => (
                <Link
                  key={f.applicationId}
                  href={`/applications/${f.applicationId}`}
                  className="hover:bg-accent flex flex-col rounded px-2 py-1 text-xs"
                >
                  <span className="font-medium">{f.studentName} — {f.companyName}</span>
                  <span className="text-muted-foreground">{f.driveTitle} · {f.detail}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
