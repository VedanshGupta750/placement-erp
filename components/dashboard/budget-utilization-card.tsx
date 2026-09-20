import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BudgetSummary } from "@/lib/budget/get-budget-summary";

function fmtINR(n: number) {
  return `₹${(n / 100000).toFixed(2)}L`;
}

export function BudgetUtilizationCard({ summary }: { summary: BudgetSummary }) {
  if (!summary.fiscalYear) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Budget utilization</CardTitle>
          <Link href="/finance" className="text-sm font-medium text-primary hover:underline">Set up</Link>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-6 text-center text-sm">No budget added yet. Add line items on the Finance page.</p>
        </CardContent>
      </Card>
    );
  }

  const overallPct = summary.utilizationPct;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Budget utilization</CardTitle>
          <p className="text-muted-foreground text-sm">{summary.fiscalYear}</p>
        </div>
        <Link href="/finance" className="text-sm font-medium text-primary hover:underline">View All</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{fmtINR(summary.utilizedGrandTotal)}</span>
            <span className="text-muted-foreground text-sm">
              of {fmtINR(summary.allottedGrandTotal)} allotted
              {overallPct !== null && ` · ${overallPct}%`}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", overallPct !== null && overallPct > 100 ? "bg-destructive" : "bg-primary")}
              style={{ width: `${overallPct !== null ? Math.min(100, overallPct) : 0}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {summary.categories.map((cat) => {
            const pct = cat.allottedTotal > 0 ? Math.round((cat.utilizedTotal / cat.allottedTotal) * 1000) / 10 : null;
            return (
              <div key={cat.category} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{cat.category}</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", pct !== null && pct > 100 ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${pct !== null ? Math.min(100, pct) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <div>{fmtINR(cat.utilizedTotal)} <span className="text-muted-foreground">/ {fmtINR(cat.allottedTotal)}</span></div>
                  <div className="text-muted-foreground text-xs">{pct !== null ? `${pct}%` : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
