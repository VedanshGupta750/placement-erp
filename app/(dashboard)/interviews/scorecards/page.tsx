import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { ScorecardTemplatesManager } from "@/components/interviews/scorecard-templates-manager";

export default async function ScorecardTemplatesPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canManage = await hasPermission(session, "round.edit");
  if (!canManage) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to scorecard templates.</CardContent>
      </Card>
    );
  }

  const [templates, roundTypeRows] = await Promise.all([
    db.scorecardTemplate.findMany({ orderBy: { roundType: "asc" } }),
    db.selectionRound.findMany({ select: { roundType: true }, distinct: ["roundType"], orderBy: { roundType: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/interviews" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft className="size-3.5" /> Back to interviews
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scorecard templates</h1>
        <p className="text-muted-foreground text-sm">Define the evaluation criteria interviewers score for each round type.</p>
      </div>

      <ScorecardTemplatesManager
        templates={templates.map((t) => ({ id: t.id, roundType: t.roundType, criteria: t.criteria as { key: string; label: string }[] }))}
        roundTypes={roundTypeRows.map((r: { roundType: string }) => r.roundType)}
      />
    </div>
  );
}
