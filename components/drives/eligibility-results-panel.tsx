"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, Clock, Download, Search, ShieldAlert, SlidersHorizontal, XCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
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
  /** Has this student already filled this drive's application form? */
  hasApplied: boolean;
  /** Company they already hold a placing offer from, if any. */
  placedAtCompany: string | null;
  departmentName: string | null;
  email: string;
  cgpa: number | null;
  liveBacklogs: number;
};

type Filter = "all" | "eligible" | "not_eligible" | "eligible_not_applied" | "applied";

// Names behind the Evaluated/Eligible counters. Before this, the published
// snapshot only ever surfaced as two numbers, so "who exactly is excluded,
// and why" meant querying the database by hand — which is the one question
// a TPO actually asks when a rule looks wrong.
export function EligibilityResultsPanel({ results }: { results: EligibilityResultRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [excludePlaced, setExcludePlaced] = useState(false);
  const [minCgpa, setMinCgpa] = useState("");
  const [maxCgpa, setMaxCgpa] = useState("");
  const [maxBacklogs, setMaxBacklogs] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [overriddenOnly, setOverriddenOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const eligibleCount = results.filter((r) => r.eligible).length;
  const overriddenCount = results.filter((r) => r.overridden && r.eligible !== r.ruleEligible).length;
  const notEligibleCount = results.length - eligibleCount;
  // The two registration-window questions: who still hasn't filled the form,
  // and who is applying despite already holding an offer.
  const eligibleNotAppliedCount = results.filter((r) => r.eligible && !r.hasApplied).length;
  const appliedCount = results.filter((r) => r.hasApplied).length;
  const placedCount = results.filter((r) => r.placedAtCompany).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (filter === "eligible" && !r.eligible) return false;
      if (filter === "not_eligible" && r.eligible) return false;
      if (filter === "eligible_not_applied" && !(r.eligible && !r.hasApplied)) return false;
      if (filter === "applied" && !r.hasApplied) return false;
      if (excludePlaced && r.placedAtCompany) return false;
      if (overriddenOnly && !r.overridden) return false;
      if (courseFilter && r.courseName !== courseFilter) return false;
      // A student with no CGPA on file can't satisfy a CGPA bound, so an
      // active bound excludes them rather than silently letting them pass.
      if (minCgpa !== "" && (r.cgpa === null || r.cgpa < Number(minCgpa))) return false;
      if (maxCgpa !== "" && (r.cgpa === null || r.cgpa > Number(maxCgpa))) return false;
      if (maxBacklogs !== "" && r.liveBacklogs > Number(maxBacklogs)) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.enrollmentNumber.toLowerCase().includes(q);
    });
  }, [results, filter, query, excludePlaced, overriddenOnly, courseFilter, minCgpa, maxCgpa, maxBacklogs]);

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
    { key: "eligible_not_applied", label: "Eligible, not applied", count: eligibleNotAppliedCount },
    { key: "applied", label: "Applied", count: appliedCount },
  ];

  const courseOptions = Array.from(new Set(results.map((r) => r.courseName).filter((c): c is string => Boolean(c)))).sort();
  const filtersActive =
    excludePlaced || overriddenOnly || courseFilter !== "" || minCgpa !== "" || maxCgpa !== "" || maxBacklogs !== "";

  function resetFilters() {
    setExcludePlaced(false);
    setOverriddenOnly(false);
    setCourseFilter("");
    setMinCgpa("");
    setMaxCgpa("");
    setMaxBacklogs("");
  }

  // Exports exactly what is on screen, filters and all — the point of the
  // button is "give me this list", not "give me the whole table again".
  // CSV rather than a real .xlsx: Excel opens it natively and it keeps the
  // export dependency-free, matching the other exports in this app.
  function exportCsv() {
    const headers = [
      "Name", "Enrollment No.", "Email", "Course", "Department", "CGPA", "Active backlogs",
      "Verdict", "Rule verdict", "Reason not eligible", "Manual override", "Override reason",
      "Applied", "Placed at",
    ];
    const cell = (v: unknown) => {
      const t = String(v ?? "");
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lines = [
      headers.join(","),
      ...visible.map((r) =>
        [
          r.name, r.enrollmentNumber, r.email, r.courseName ?? "", r.departmentName ?? "",
          r.cgpa ?? "", r.liveBacklogs,
          r.eligible ? "Eligible" : "Not eligible",
          r.ruleEligible ? "Eligible" : "Not eligible",
          r.failedReason ?? "",
          r.overridden ? "Yes" : "No",
          r.overrideReason ?? "",
          r.hasApplied ? "Yes" : "No",
          r.placedAtCompany ?? "",
        ].map(cell).join(","),
      ),
    ];
    // BOM so Excel reads the file as UTF-8 and doesn't mangle names.
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eligibility-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                excludePlaced ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
              title="Hide students who already hold an accepted or joined offer from any drive"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={excludePlaced}
                onChange={(e) => setExcludePlaced(e.target.checked)}
              />
              <Ban className="size-3.5" />
              Exclude placed
              <span className="tabular-nums opacity-70">({placedCount})</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              showFilters || filtersActive ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            <SlidersHorizontal className="size-3.5" /> Filters
            {filtersActive && <span className="tabular-nums">·on</span>}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="hover:bg-accent flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50"
            title="Downloads exactly the rows shown, with every filter applied. Opens in Excel."
          >
            <Download className="size-3.5" /> Export ({visible.length})
          </button>

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

        {showFilters && (
          <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-min-cgpa">Min CGPA</Label>
              <Input id="er-min-cgpa" type="number" step="0.1" min={0} max={10} value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} placeholder="Any" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-max-cgpa">Max CGPA</Label>
              <Input id="er-max-cgpa" type="number" step="0.1" min={0} max={10} value={maxCgpa} onChange={(e) => setMaxCgpa(e.target.value)} placeholder="Any" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-max-backlogs">Max backlogs</Label>
              <Input id="er-max-backlogs" type="number" min={0} value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} placeholder="Any" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="er-course">Course</Label>
              <select
                id="er-course"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="border-input bg-transparent h-9 rounded-md border px-2 text-sm"
              >
                <option value="">Any</option>
                {courseOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={overriddenOnly} onChange={(e) => setOverriddenOnly(e.target.checked)} />
                Overridden only
              </label>
              {filtersActive && (
                <button type="button" onClick={resetFilters} className="text-muted-foreground hover:text-foreground w-fit text-xs underline">
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}

        {visible.length !== results.length && (
          <p className="text-muted-foreground text-xs">
            Showing {visible.length} of {results.length} evaluated students.
          </p>
        )}

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
                      {r.placedAtCompany && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                          title="Already holds an accepted or joined offer"
                        >
                          <Ban className="size-3" /> Placed · {r.placedAtCompany}
                        </span>
                      )}
                      {r.eligible && !r.hasApplied && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
                          <Clock className="size-3" /> Not applied yet
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
