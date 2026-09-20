"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Users, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Detected = {
  messageId: string;
  summary: string;
  courseKeywords: string[];
  minCgpa: number | null;
  count: number | null;
  href: string;
  matchedCourseName: string | null;
  unmatchedCourseKeywords: string[];
};

export function RequestDetectorCard({ conversationId }: { conversationId: string }) {
  const [pending, setPending] = useState(false);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);

  async function analyse() {
    setPending(true);
    setEmptyMessage(null);
    const res = await fetch(`/api/messages/${conversationId}/detect-request`, { method: "POST" });
    setPending(false);

    if (!res.ok) {
      toast.error("Couldn't analyse this conversation.");
      return;
    }
    const data = await res.json();
    if (data.stub) toast.info("AI isn't configured — used keyword matching instead.");
    if (data.detected) {
      setDetected(data.detected);
    } else {
      setDetected(null);
      setEmptyMessage(data.message ?? "Nothing actionable found.");
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Recruitment request</span>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={analyse}>
          <Sparkles className="size-3.5" /> {pending ? "Reading…" : detected ? "Re-check" : "Check latest"}
        </Button>
      </div>

      {!detected && !emptyMessage && (
        <p className="text-muted-foreground mt-2 text-xs">
          Pull the ask out of the latest incoming message and jump straight to matching candidates.
        </p>
      )}

      {emptyMessage && <p className="text-muted-foreground mt-2 text-xs">{emptyMessage}</p>}

      {detected && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm">{detected.summary}</p>

          <div className="flex flex-wrap gap-1.5">
            {detected.count != null && <Badge variant="outline">{detected.count} candidates</Badge>}
            {detected.minCgpa != null && <Badge variant="outline">CGPA ≥ {detected.minCgpa}</Badge>}
            {detected.matchedCourseName && <Badge variant="outline">{detected.matchedCourseName}</Badge>}
          </div>

          {detected.unmatchedCourseKeywords.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Couldn&apos;t match {detected.unmatchedCourseKeywords.join(", ")} to a course in your list — apply that filter
              manually.
            </p>
          )}

          <Button size="sm" className="w-fit" render={<Link href={detected.href} />}>
            <Users className="size-3.5" /> Find candidates <ArrowUpRight className="size-3.5" />
          </Button>

          <p className="text-muted-foreground text-xs">
            AI-extracted from the message — check the criteria before acting.
          </p>
        </div>
      )}
    </div>
  );
}
