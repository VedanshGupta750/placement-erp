import Link from "next/link";
import { IndianRupee, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceActions } from "@/components/finance/finance-actions";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { ExpenseBreakdownChart } from "@/components/finance/expense-breakdown-chart";
import { RevenueBreakdownChart } from "@/components/finance/revenue-breakdown-chart";
import { FinanceTrendChart } from "@/components/finance/finance-trend-chart";
import { BudgetTable } from "@/components/finance/budget-table";
import { RecordBudgetItemDialog } from "@/components/finance/record-budget-item-dialog";
import { getBudgetSummary } from "@/lib/budget/get-budget-summary";
import { cn } from "@/lib/utils";

function fmtINR(n: number) {
  return `₹${(n / 100000).toFixed(1)}L`;
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ fiscalYear?: string }> }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const params = await searchParams;

  const canView = await hasPermission(session, "finance.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to placement finance.</CardContent>
      </Card>
    );
  }
  const canManage = await hasPermission(session, "finance.manage");

  const [expenses, revenues, drives, events, partnerships, budgetSummary] = await Promise.all([
    db.placementExpense.findMany({
      include: { drive: { select: { title: true } }, event: { select: { title: true } }, recordedBy: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
    }),
    db.placementRevenue.findMany({
      include: {
        drive: { select: { title: true } },
        event: { select: { title: true } },
        company: { select: { name: true } },
        recordedBy: { select: { name: true } },
      },
      orderBy: { receivedDate: "desc" },
    }),
    db.drive.findMany({ select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.event.findMany({ select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.collegePartnership.findMany({ include: { company: { select: { id: true, name: true } } }, orderBy: { connectedAt: "desc" } }),
    getBudgetSummary(db, session.collegeId, params.fiscalYear),
  ]);

  const totalExpenses = expenses.reduce((s: number, e: { amount: unknown }) => s + Number(e.amount), 0);
  const totalRevenue = revenues.reduce((s: number, r: { amount: unknown }) => s + Number(r.amount), 0);
  const net = totalRevenue - totalExpenses;

  const companies = partnerships.map((p: { company: { id: string; name: string } }) => p.company);

  const transactions = [
    ...expenses.map((e: { id: string; category: string; description: string; amount: unknown; expenseDate: Date; drive: { title: string } | null; event: { title: string } | null; recordedBy: { name: string } }) => ({
      id: e.id,
      type: "expense" as const,
      label: e.category,
      description: e.description,
      amount: Number(e.amount),
      date: e.expenseDate.toISOString(),
      linkedTo: e.drive?.title ?? e.event?.title ?? null,
      recordedBy: e.recordedBy.name,
    })),
    ...revenues.map((r: { id: string; source: string; description: string; amount: unknown; receivedDate: Date; drive: { title: string } | null; event: { title: string } | null; company: { name: string } | null; recordedBy: { name: string } }) => ({
      id: r.id,
      type: "revenue" as const,
      label: r.source,
      description: r.description,
      amount: Number(r.amount),
      date: r.receivedDate.toISOString(),
      linkedTo: r.drive?.title ?? r.event?.title ?? r.company?.name ?? null,
      recordedBy: r.recordedBy.name,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Category-wise / source-wise breakdown for the two bar charts.
  const expenseByCategory = new Map<string, number>();
  for (const e of expenses as { category: string; amount: unknown }[]) {
    expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const expenseBreakdown = Array.from(expenseByCategory, ([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  const revenueBySource = new Map<string, number>();
  for (const r of revenues as { source: string; amount: unknown }[]) {
    revenueBySource.set(r.source, (revenueBySource.get(r.source) ?? 0) + Number(r.amount));
  }
  const revenueBreakdown = Array.from(revenueBySource, ([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  // Last 6 calendar months (oldest first), revenue vs expenses per month —
  // built from fixed month buckets rather than grouping only months that
  // have data, so a month with zero activity still shows as a flat ₹0
  // point instead of silently disappearing from the trend line.
  const monthBuckets: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
  }
  const trendMap = new Map(monthBuckets.map((b) => [b.key, { revenue: 0, expenses: 0 }]));
  for (const e of expenses as { amount: unknown; expenseDate: Date }[]) {
    const key = `${e.expenseDate.getFullYear()}-${e.expenseDate.getMonth()}`;
    const bucket = trendMap.get(key);
    if (bucket) bucket.expenses += Number(e.amount);
  }
  for (const r of revenues as { amount: unknown; receivedDate: Date }[]) {
    const key = `${r.receivedDate.getFullYear()}-${r.receivedDate.getMonth()}`;
    const bucket = trendMap.get(key);
    if (bucket) bucket.revenue += Number(r.amount);
  }
  const trend = monthBuckets.map((b) => ({ month: b.label, ...trendMap.get(b.key)! }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Placement Finance</h1>
          <p className="text-muted-foreground text-sm">Expenses and revenue tied to running drives and events.</p>
        </div>
        {canManage && (
          <FinanceActions
            drives={drives}
            events={events}
            companies={companies}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={TrendingUp} label="Total revenue" value={fmtINR(totalRevenue)} color="emerald" />
        <StatCard icon={TrendingDown} label="Total expenses" value={fmtINR(totalExpenses)} color="rose" />
        <StatCard icon={net >= 0 ? Wallet : IndianRupee} label="Net" value={fmtINR(net)} color={net >= 0 ? "blue" : "amber"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue vs expenses — last 6 months</CardTitle></CardHeader>
        <CardContent>
          <FinanceTrendChart data={trend} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Spending by category</CardTitle></CardHeader>
          <CardContent>
            <ExpenseBreakdownChart data={expenseBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by source</CardTitle></CardHeader>
          <CardContent>
            <RevenueBreakdownChart data={revenueBreakdown} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All transactions</CardTitle></CardHeader>
        <CardContent>
          <TransactionsTable transactions={transactions} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-stretch justify-between gap-3 space-y-0 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <CardTitle className="text-base">CDPC budget</CardTitle>
            {budgetSummary.fiscalYear && (
              <p className="text-muted-foreground text-sm">
                Year-wise allotted vs utilized vs requested, by category — {budgetSummary.fiscalYear}
              </p>
            )}
          </div>
          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {budgetSummary.fiscalYears.length > 1 && (
              <div className="flex items-center gap-1">
                {budgetSummary.fiscalYears.map((y) => (
                  <Link
                    key={y}
                    href={`/finance?fiscalYear=${y}`}
                    scroll={false}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium",
                      y === budgetSummary.fiscalYear ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {y}
                  </Link>
                ))}
              </div>
            )}
            {canManage && (
              <RecordBudgetItemDialog
                defaultFiscalYear={budgetSummary.fiscalYear ?? "2026-2027"}
                categories={[...new Set(budgetSummary.categories.map((c) => c.category))]}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <BudgetTable
            categories={budgetSummary.categories}
            allottedGrandTotal={budgetSummary.allottedGrandTotal}
            utilizedGrandTotal={budgetSummary.utilizedGrandTotal}
            requestedGrandTotal={budgetSummary.requestedGrandTotal}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
