"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ApplicationsBulkActionsBar } from "@/components/applications/applications-bulk-actions-bar";

export type ApplicationRow = {
  id: string;
  enrollmentNumber: string;
  studentName: string;
  studentId: string;
  courseLabel: string;
  liveBacklogs: number;
  driveTitle: string;
  driveId: string;
  companyName: string;
  matchScore: number | null;
  appliedAt: string;
  status: string;
  priority: string;
};

const PRIORITY_CLASSES: Record<string, string> = {
  HIGH: "text-amber-600 dark:text-amber-400",
  URGENT: "text-rose-600 dark:text-rose-400",
};

export function ApplicationsTable({ rows }: { rows: ApplicationRow[] }) {
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
      {selected.size > 0 && <ApplicationsBulkActionsBar applicationIds={[...selected]} onDone={() => setSelected(new Set())} />}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
              <TableHead>Enrollment No.</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Backlogs</TableHead>
              <TableHead>Drive</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} aria-label={`Select ${a.studentName}`} /></TableCell>
                <TableCell className="font-mono text-xs">{a.enrollmentNumber}</TableCell>
                <TableCell>
                  <Link href={`/applications/${a.id}`} className={`font-medium hover:underline ${PRIORITY_CLASSES[a.priority] ?? ""}`}>
                    {a.studentName}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    <Link href={`/students/${a.studentId}`} className="hover:underline">View profile</Link>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{a.courseLabel}</TableCell>
                <TableCell className="tabular-nums">{a.liveBacklogs}</TableCell>
                <TableCell>
                  <Link href={`/drives/${a.driveId}`} className="hover:underline">{a.driveTitle}</Link>
                  <div className="text-muted-foreground text-xs">{a.companyName}</div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm tabular-nums">{a.matchScore !== null ? `${a.matchScore}%` : "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {new Date(a.appliedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-10 text-center text-sm">No applications match these filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
