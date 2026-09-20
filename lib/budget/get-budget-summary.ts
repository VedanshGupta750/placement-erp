// Real numbers only — every total here is summed from Budget rows a TPO
// entered (transcribed from the actual office-note budget document), never
// a hardcoded grand total. The source document's own "Grand Total" row is
// deliberately NOT trusted/replicated: office notes are hand-typed and can
// (and did, in the real one this was built from) contain arithmetic slips,
// so this always recomputes from the line items instead.

export type BudgetItemRow = {
  id: string;
  category: string;
  item: string;
  allottedAmount: number | null;
  utilizedAmount: number | null;
  requestedAmount: number | null;
};

export type BudgetCategorySummary = {
  category: string;
  items: BudgetItemRow[];
  allottedTotal: number;
  utilizedTotal: number;
  requestedTotal: number;
};

export type BudgetSummary = {
  fiscalYear: string | null;
  fiscalYears: string[];
  categories: BudgetCategorySummary[];
  allottedGrandTotal: number;
  utilizedGrandTotal: number;
  requestedGrandTotal: number;
  utilizationPct: number | null;
};

// `db` is intentionally untyped (`any`) — tenant-scoped client, same
// convention as lib/applications.ts and lib/dashboard/*.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBudgetSummary(db: any, collegeId: string, fiscalYear?: string): Promise<BudgetSummary> {
  const distinctYears = await db.budget.findMany({
    select: { fiscalYear: true },
    distinct: ["fiscalYear"],
    orderBy: { fiscalYear: "desc" },
  });
  const fiscalYears = distinctYears.map((r: { fiscalYear: string }) => r.fiscalYear);

  const effectiveYear = fiscalYear ?? fiscalYears[0] ?? null;
  if (!effectiveYear) {
    return { fiscalYear: null, fiscalYears: [], categories: [], allottedGrandTotal: 0, utilizedGrandTotal: 0, requestedGrandTotal: 0, utilizationPct: null };
  }

  const rows = await db.budget.findMany({
    where: { fiscalYear: effectiveYear },
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });

  const byCategory = new Map<string, BudgetItemRow[]>();
  for (const r of rows as {
    id: string;
    category: string;
    item: string;
    allottedAmount: unknown;
    utilizedAmount: unknown;
    requestedAmount: unknown;
  }[]) {
    const row: BudgetItemRow = {
      id: r.id,
      category: r.category,
      item: r.item,
      allottedAmount: r.allottedAmount != null ? Number(r.allottedAmount) : null,
      utilizedAmount: r.utilizedAmount != null ? Number(r.utilizedAmount) : null,
      requestedAmount: r.requestedAmount != null ? Number(r.requestedAmount) : null,
    };
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category)!.push(row);
  }

  const categories: BudgetCategorySummary[] = [...byCategory.entries()].map(([category, items]) => ({
    category,
    items,
    allottedTotal: items.reduce((s, i) => s + (i.allottedAmount ?? 0), 0),
    utilizedTotal: items.reduce((s, i) => s + (i.utilizedAmount ?? 0), 0),
    requestedTotal: items.reduce((s, i) => s + (i.requestedAmount ?? 0), 0),
  }));

  const allottedGrandTotal = categories.reduce((s, c) => s + c.allottedTotal, 0);
  const utilizedGrandTotal = categories.reduce((s, c) => s + c.utilizedTotal, 0);
  const requestedGrandTotal = categories.reduce((s, c) => s + c.requestedTotal, 0);

  return {
    fiscalYear: effectiveYear,
    fiscalYears,
    categories,
    allottedGrandTotal,
    utilizedGrandTotal,
    requestedGrandTotal,
    utilizationPct: allottedGrandTotal > 0 ? Math.round((utilizedGrandTotal / allottedGrandTotal) * 1000) / 10 : null,
  };
}
