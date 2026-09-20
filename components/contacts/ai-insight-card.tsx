"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AiInsightCard({ contactId }: { contactId: string }) {
  const [pending, setPending] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    const res = await fetch(`/api/contacts/${contactId}/ai-insight`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      setInsight(data.insight);
      if (data.stub) toast.info("AI isn't configured — showing the raw data snapshot instead of a generated summary.");
    } else {
      toast.error("Couldn't generate an insight right now.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI Relationship Insight</CardTitle>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={generate}>
          <Sparkles className="size-3.5" /> {pending ? "Thinking…" : insight ? "Regenerate" : "Generate insight"}
        </Button>
      </CardHeader>
      <CardContent>
        {insight ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm whitespace-pre-wrap">{insight}</p>
            <p className="text-muted-foreground text-xs">AI-generated from this contact&apos;s real activity — a suggestion, not a fact. Verify before acting.</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Generate a quick AI summary of this relationship's health and a suggested next step, based on this contact's real activity.</p>
        )}
      </CardContent>
    </Card>
  );
}
