"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { PartnershipStatusBadge } from "@/components/companies/partnership-status-badge";
import { CompaniesBulkActionsBar } from "@/components/companies/companies-bulk-actions-bar";
import type { CompanyCardData } from "@/components/companies/company-card";

export function CompaniesTable({ companies }: { companies: CompanyCardData[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = companies.length > 0 && selected.size === companies.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(companies.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <CompaniesBulkActionsBar companyIds={[...selected]} onDone={() => setSelected(new Set())} />
      )}
      {selected.size === 1 && <p className="text-muted-foreground text-xs">Select 2–5 companies to compare.</p>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr>
              <th className="w-8 px-3 py-2"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></th>
              <th className="px-3 py-2 text-left font-medium">Company</th>
              <th className="px-3 py-2 text-left font-medium">Industry</th>
              <th className="px-3 py-2 text-right font-medium">Drives</th>
              <th className="px-3 py-2 text-right font-medium">Applications</th>
              <th className="px-3 py-2 text-right font-medium">Offers</th>
              <th className="px-3 py-2 text-right font-medium">Avg CTC</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-accent/40">
                <td className="px-3 py-2"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} /></td>
                <td className="px-3 py-2">
                  <Link href={`/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{c.industryType ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.drives}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.applications}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.offers}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.avgCtc != null ? `₹${c.avgCtc}L` : "—"}</td>
                <td className="px-3 py-2"><PartnershipStatusBadge status={c.status} /></td>
                <td className="px-3 py-2 text-muted-foreground">
                  {c.lastActivityAt ? c.lastActivityAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={9} className="text-muted-foreground py-8 text-center text-sm">No companies match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
