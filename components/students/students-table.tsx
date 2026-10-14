"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BulkActionsBar } from "@/components/students/bulk-actions-bar";

export type StudentRow = {
  id: string;
  enrollmentNumber: string;
  name: string;
  email: string;
  courseLabel: string;
  cgpa: number | null;
  tenthScore: number | null;
  twelfthScore: number | null;
  liveBacklogs: number;
  eligibleForPlacements: boolean;
  placementStatus: string;
  /** User.status — account access, independent of placementStatus. */
  accountStatus: string;
};

export function StudentsTable({
  rows,
  canEdit = false,
  canDelete = false,
}: {
  rows: StudentRow[];
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function selectAll() {
    setSelected(new Set(rows.map((r) => r.id)));
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
      {selected.size > 0 && (
        <BulkActionsBar
          studentIds={[...selected]}
          onDone={() => setSelected(new Set())}
          canEdit={canEdit}
          canDelete={canDelete}
          selectableCount={rows.length}
          onSelectAll={selectAll}
        />
      )}
      <div className="overflow-x-auto">
        <Table className="min-w-[58rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
              <TableHead>Enrollment No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>CGPA</TableHead>
              <TableHead>10th %</TableHead>
              <TableHead>12th %</TableHead>
              <TableHead>Backlogs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={selected.has(r.id) ? "bg-accent/30" : undefined}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} />
                </TableCell>
                <TableCell className="font-mono text-xs">{r.enrollmentNumber}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/students/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    {r.accountStatus === "SUSPENDED" && (
                      <Badge variant="outline" className="text-destructive border-destructive/40">Suspended</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">{r.email}</div>
                </TableCell>
                <TableCell className="text-sm">{r.courseLabel}</TableCell>
                <TableCell className="tabular-nums">{r.cgpa ?? "-"}</TableCell>
                <TableCell className="tabular-nums">{r.tenthScore ?? "-"}</TableCell>
                <TableCell className="tabular-nums">{r.twelfthScore ?? "-"}</TableCell>
                <TableCell>
                  {r.liveBacklogs > 0 ? (
                    <Badge variant="outline" className="text-amber-600">{r.liveBacklogs}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.placementStatus === "PLACED" ? (
                    <Badge className="border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Placed</Badge>
                  ) : r.eligibleForPlacements ? (
                    <Badge variant="outline">Eligible</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not eligible</Badge>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Link href={`/students/${r.id}`} className="text-muted-foreground hover:text-foreground" aria-label="Open profile">
                    <MoreVertical className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground py-10 text-center text-sm">No students match these filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
