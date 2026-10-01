"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { toast } from "sonner";

type Candidate = {
  id: string;
  status: string;
  score: number | null;
  scheduledAt: string | null;
  student: { user: { name: string } };
};
type Round = { id: string; name: string; roundType: string; sequenceNo: number; status: string; candidates: Candidate[] };

function CandidateRow({ driveId, candidate }: { driveId: string; candidate: Candidate }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function schedule() {
    const scheduledAt = prompt("Schedule date/time (YYYY-MM-DDTHH:mm):");
    if (!scheduledAt) return;
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "schedule", mode: "ONLINE", scheduledAt }),
    });
    setPending(false);
    if (res.ok) { toast.success("Scheduled"); router.refresh(); } else toast.error("Couldn't schedule.");
  }

  async function score(result: "PASSED" | "FAILED") {
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "score", result }),
    });
    setPending(false);
    if (res.ok) { toast.success("Result recorded"); router.refresh(); } else toast.error("Couldn't record result.");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <div>
        <span className="font-medium">{candidate.student.user.name}</span>
        {candidate.scheduledAt && <span className="text-muted-foreground ml-2 text-xs">{new Date(candidate.scheduledAt).toLocaleString("en-IN")}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={candidate.status} />
        {candidate.status === "ASSIGNED" && <Button size="sm" variant="outline" disabled={pending} onClick={schedule}>Schedule</Button>}
        {(candidate.status === "SCHEDULED" || candidate.status === "IN_PROGRESS") && (
          <>
            <Button size="sm" disabled={pending} onClick={() => score("PASSED")}>Pass</Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => score("FAILED")}>Fail</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function RoundsPanel({ driveId, rounds }: { driveId: string; rounds: Round[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function createRound(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/drives/${driveId}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), roundType: fd.get("roundType") }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Round created");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      toast.error("Couldn't create round.");
    }
  }

  async function assignShortlisted(roundId: string) {
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/rounds/${roundId}/candidates`, { method: "POST" });
    const data = await res.json();
    setPending(false);
    if (res.ok) {
      toast.success(`${data.assigned} candidate(s) assigned`);
      router.refresh();
    } else {
      toast.error("Couldn't assign candidates.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add a round</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createRound} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Round name</Label>
              <Input id="name" name="name" placeholder="Technical Interview" required className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roundType">Type</Label>
              <Input id="roundType" name="roundType" placeholder="Technical / HR / Aptitude" required className="w-48" />
            </div>
            <Button type="submit" disabled={pending}>Add round</Button>
          </form>
        </CardContent>
      </Card>

      {rounds.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Round {r.sequenceNo}: {r.name} <span className="text-muted-foreground font-normal">({r.roundType})</span></CardTitle>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => assignShortlisted(r.id)}>
              Assign shortlisted candidates
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {r.candidates.map((c) => (
              <CandidateRow key={c.id} driveId={driveId} candidate={c} />
            ))}
            {r.candidates.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No candidates assigned yet.</p>}
          </CardContent>
        </Card>
      ))}
      {rounds.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No selection rounds yet.</p>}
    </div>
  );
}
