"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Search, ShieldAlert, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EligibilityResultRow = {
  studentId: string;
  name: string;
  enrollmentNumber: string;
  courseName: string | null;
  /** The verdict in force now: the manual override if one exists, else the rule's. */
  eligible: boolean;
  /** What the published rule alone decided, before any override. */
  ruleEligible: boolean;
  /** Plain-English first failing condition, or null when they passed. */
  failedReason: string | null;
  /** True when a manual override decided this student's verdict. */
  overridden: boolean;
  overrideReason: string | null;
};

type Filter = "all" | "eligible" | "not_eligible";

// Names behind the Evaluated/Eligible counters. Before this, the published
// snapshot only ever surfaced as two numbers, so "who exactly is excluded,
// and why" meant querying the database by hand — which is the one question
// a TPO actually asks when a rule looks wrong.
export function EligibilityResultsPanel({ results }: { results: EligibilityResultRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const eligibleCount = results.filter((r) => r.eligible).length;
  const overriddenCount = results.filter((r) => r.overridden && r.eligible !== r.ruleEligible).length;
  const notEligibleCount = results.length - eligibleCount;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (filter === "eligible" && !r.eligible) return false;
      if (filter === "not_eligible" && r.eligible) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.enrollmentNumber.toLowerCase().includes(q);
    });
  }, [results, filter, query]);

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluated students</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No eligibility rule has been published for this drive yet. Author a rule below and publish it to see who
            qualifies.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: results.length },
    { key: "eligible", label: "Eligible", count: eligibleCount },
    { key: "not_eligible", label: "Not eligible", count: notEligibleCount },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evaluated students</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  filter === t.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t.label} <span className="tabular-nums">({t.count})</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or enrollment no."
              className="pl-8"
            />
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto rounded-md border">
          <ul className="divide-y">
            {visible.map((r) => (
              <li key={r.studentId} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  {r.eligible ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/students/${r.studentId}`} className="text-sm font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">{r.enrollmentNumber}</span>
                      {r.overridden && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          <ShieldAlert className="size-3" /> Manual override
                        </span>
                      )}
                    </div>
                    {r.courseName && <div className="text-muted-foreground text-xs">{r.courseName}</div>}
                    {r.overridden ? (
                      <p className="text-muted-foreground mt-0.5 text-xs break-words">
                        {r.overrideReason}
                        {r.eligible !== r.ruleEligible && (
                          <span className="text-muted-foreground/80">
                            {" — "}
                            the rule said {r.ruleEligible ? "eligible" : "not eligible"}
                            {r.failedReason && !r.ruleEligible ? ` (${r.failedReason})` : ""}
                          </span>
                        )}
                      </p>
                    ) : (
                      !r.eligible && r.failedReason && (
                        <p className="text-muted-foreground mt-0.5 text-xs break-words">{r.failedReason}</p>
                      )
                    )}
                  </div>
                </div>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="text-muted-foreground px-3 py-8 text-center text-sm">No students match this filter.</li>
            )}
          </ul>
        </div>

        <p className="text-muted-foreground text-xs">
          Showing {visible.length} of {results.length}.{" "}
          {overriddenCount > 0
            ? `${overriddenCount} verdict${overriddenCount === 1 ? " is" : "s are"} set by a manual override and already counted above. Re-publish the rule to freeze them into the snapshot.`
            : "Based on the last published rule, with any manual overrides applied on top."}
        </p>
      </CardContent>
    </Card>
  );
}
