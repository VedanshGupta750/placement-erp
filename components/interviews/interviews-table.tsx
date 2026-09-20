"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InterviewRowActions } from "@/components/interviews/interview-row-actions";
import { InterviewsBulkActionsBar } from "@/components/interviews/interviews-bulk-actions-bar";

const RESULT_STATUSES = ["PASSED", "FAILED", "NO_SHOW"];

export type InterviewRow = {
  id: string;
  status: string;
  score: number | null;
  scheduledAt: string | null;
  mode: string;
  venue: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
  interviewerId: string | null;
  studentName: string;
  studentId: string;
  applicationId: string;
  driveId: string;
  driveTitle: string;
  companyName: string;
  roundName: string;
  roundType: string;
};

export function InterviewsTable({ rows }: { rows: InterviewRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
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
      {selected.size > 0 && <InterviewsBulkActionsBar candidateIds={[...selected]} onDone={() => setSelected(new Set())} />}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Drive / Company</TableHead>
              <TableHead>Round</TableHead>
              <TableHead>Date &amp; Time</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Interviewer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.studentName}`} /></TableCell>
                <TableCell>
                  <Link href={`/interviews/${r.id}`} className="font-medium hover:underline">{r.studentName}</Link>
                </TableCell>
                <TableCell>
                  <Link href={`/drives/${r.driveId}`} className="hover:underline">{r.companyName}</Link>
                  <div className="text-muted-foreground text-xs">{r.driveTitle}</div>
                </TableCell>
                <TableCell className="text-sm">{r.roundName}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {r.scheduledAt ? new Date(r.scheduledAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                </TableCell>
                <TableCell className="text-sm">{r.scheduledAt ? (r.mode === "ONLINE" ? "Online" : "Offline") : "-"}</TableCell>
                <TableCell className="text-sm">{r.interviewerName ?? "-"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="tabular-nums">{r.score ?? "-"}</TableCell>
                <TableCell>{RESULT_STATUSES.includes(r.status) ? <StatusBadge status={r.status} /> : "-"}</TableCell>
                <TableCell className="text-right">
                  <InterviewRowActions candidate={r} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground py-10 text-center text-sm">No interviews match these filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
