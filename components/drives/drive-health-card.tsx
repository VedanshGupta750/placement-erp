import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeDriveHealthSignals } from "@/lib/drives/health-signals";

export function DriveHealthCard(props: Parameters<typeof computeDriveHealthSignals>[0]) {
  const { score, signals } = computeDriveHealthSignals(props);
  const label = score >= 70 ? "Healthy" : score >= 40 ? "Needs Attention" : "At Risk";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Drive Health</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">{score}</span>
          <span className="text-muted-foreground text-sm">/ 100</span>
          <Badge variant="outline">{label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {signals.map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {s.tone === "positive" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <span>{s.text}</span>
          </div>
        ))}
        <p className="text-muted-foreground mt-1 text-xs">Computed from this drive&apos;s real applications, shortlist, interview, and offer counts — not a fact, a signal to act on.</p>
      </CardContent>
    </Card>
  );
}
