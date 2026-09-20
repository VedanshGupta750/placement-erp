"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CompanyResult = {
  id: string;
  name: string;
  industryType: string | null;
  status: string;
  studentsHiredLastYear: number;
  hasDriveThisYear: boolean;
  offers: number;
  joiningRate: number;
};

type QueryResult = {
  stub: boolean;
  matchedIds: string[];
  companies: CompanyResult[];
  unmatched: string[];
  interpreted: Record<string, unknown>;
};

const EXAMPLES = [
  "Companies that hired 10+ students last year but no drive this year",
  "Highest joining rate companies",
  "Dormant IT companies",
];

// Natural-language filter/rank query over partner companies — never a bulk
// action itself, only ever produces a list for the TPO to review, same
// contract as the Students AI query bar.
export function CompaniesAiQueryBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  async function run(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/companies/ai-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      setResult(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't run that query.");
    }
  }

  const interpretedChips = result
    ? Object.entries(result.interpreted).filter(([, v]) => v !== null && v !== undefined && v !== "")
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Sparkles className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(query); }}
            placeholder='Ask AI — "companies hiring 10+ students but no drive this year"'
            className="pl-8"
          />
        </div>
        <Button type="button" size="sm" disabled={loading || !query.trim()} onClick={() => run(query)}>
          {loading ? "Thinking…" : "Ask"}
        </Button>
      </div>

      {!result && !loading && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setQuery(ex); run(ex); }} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border px-2.5 py-1 text-xs transition-colors">
              {ex}
            </button>
          ))}
        </div>
      )}

      {result && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {result.stub && (
              <p className="text-muted-foreground text-xs">AI generation isn&apos;t configured — showing all partner companies unfiltered instead of real understanding.</p>
            )}
            {interpretedChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {interpretedChips.map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs">{k}: {String(v)}</Badge>
                ))}
              </div>
            )}
            {result.unmatched.length > 0 && (
              <div className="text-muted-foreground text-xs">
                {result.unmatched.map((u, i) => <p key={i}>⚠️ {u}</p>)}
              </div>
            )}
            <p className="text-sm font-medium">{result.companies.length} compan{result.companies.length === 1 ? "y" : "ies"} found</p>
            <div className="flex max-h-40 flex-col divide-y overflow-y-auto">
              {result.companies.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span>{c.name} <span className="text-muted-foreground text-xs">({c.industryType ?? "—"})</span></span>
                  <span className="text-muted-foreground text-xs">{c.studentsHiredLastYear} hired last yr · {c.joiningRate}% joining</span>
                </div>
              ))}
              {result.companies.length > 10 && <p className="text-muted-foreground py-1.5 text-xs">+{result.companies.length - 10} more</p>}
            </div>
            {result.companies.length > 0 && (
              <Button size="sm" className="w-fit" render={<Link href={`/companies?ids=${result.matchedIds.join(",")}`} />}>
                View as filtered list <ArrowRight className="size-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
