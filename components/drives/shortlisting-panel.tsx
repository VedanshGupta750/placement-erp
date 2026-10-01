"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Applicant = {
  id: string;
  studentId: string;
  status: string;
  matchScore: number | null;
  student: { enrollmentNumber: string; user: { name: string } };
};

// Ranks not-yet-decided applicants by the existing skill-match score
// (lib/matching.ts, already computed at apply time — no new AI call here)
// so a TPO can work top-down instead of shortlisting in application-date
// order. The score is a real skill-overlap calculation, always labelled as
// a match percentage, never framed as a final decision — shortlist/reject
// is still a human action per row.
export function ShortlistingPanel({ driveId, applicants }: { driveId: string; applicants: Applicant[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const candidates = applicants
    .filter((a) => ["APPLIED", "COLLEGE_APPROVED", "SCREENING"].includes(a.status))
    .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));

  async function act(applicationId: string, action: string) {
    setPendingId(applicationId);
    const res = await fetch(`/api/drives/${driveId}/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPendingId(null);
    if (res.ok) {
      toast.success("Application updated");
      router.refresh();
    } else {
      toast.error("Couldn't update application.");
    }
  }

  if (candidates.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No applicants awaiting a shortlisting decision.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Sparkles className="size-3.5" /> Ranked by skill-match score, highest first — a suggestion to prioritize review, not a final decision.
      </p>
      <div className="flex flex-col divide-y">
        {candidates.map((a, i) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-6 text-right text-sm tabular-nums">{i + 1}</span>
              <div>
                <Link href={`/students/${a.studentId}`} className="font-medium hover:underline">{a.student.user.name}</Link>
                <div className="text-muted-foreground text-xs">{a.student.enrollmentNumber}</div>
              </div>
              {a.matchScore != null && <Badge variant="outline">{a.matchScore}% match</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {a.status === "APPLIED" ? (
                <Button size="sm" disabled={pendingId === a.id} onClick={() => act(a.id, "approve")}>Approve</Button>
              ) : (
                <Button size="sm" disabled={pendingId === a.id} onClick={() => act(a.id, "shortlist")}>Shortlist</Button>
              )}
              <Button size="sm" variant="ghost" disabled={pendingId === a.id} onClick={() => act(a.id, "reject")}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
