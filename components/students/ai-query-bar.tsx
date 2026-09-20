"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type QueryResult = {
  stub: boolean;
  matchedIds: string[];
  students: { id: string; enrollmentNumber: string; name: string; courseLabel: string; cgpa: number | null }[];
  unmatched: string[];
  interpreted: Record<string, unknown>;
};

const EXAMPLES = [
  "CSE students eligible for Siemens but not yet applied",
  "Unplaced students with CGPA above 8",
  "Students with active backlogs in ECE",
];

// Natural-language filter query — translates a plain-English question into
// real filters/eligibility checks (never a bulk action itself; it only ever
// produces a list for the TPO to review, same "human confirms before
// anything happens" rule as the rest of this app's AI features).
export function AiQueryBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  async function run(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/students/ai-query", {
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
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Sparkles className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(query); }}
            placeholder='Ask AI — "CSE students eligible for Siemens but not applied"'
            className="pl-8"
          />
        </div>
        <Button type="button" size="sm" className="shrink-0" disabled={loading || !query.trim()} onClick={() => run(query)}>
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
              <p className="text-muted-foreground text-xs">AI generation isn&apos;t configured — showing a best-effort match on the raw text instead of real understanding.</p>
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
            <p className="text-sm font-medium">{result.students.length} student{result.students.length === 1 ? "" : "s"} found</p>
            <div className="flex max-h-40 flex-col divide-y overflow-y-auto">
              {result.students.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span>{s.name} <span className="text-muted-foreground text-xs">({s.enrollmentNumber})</span></span>
                  <span className="text-muted-foreground text-xs">{s.courseLabel}{s.cgpa != null ? ` · ${s.cgpa}` : ""}</span>
                </div>
              ))}
              {result.students.length > 10 && <p className="text-muted-foreground py-1.5 text-xs">+{result.students.length - 10} more</p>}
            </div>
            {result.students.length > 0 && (
              <Button size="sm" className="w-fit" render={<Link href={`/students?ids=${result.matchedIds.join(",")}`} />}>
                View as filtered list <ArrowRight className="size-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
