"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { OffersBulkActionsBar } from "@/components/offers/offers-bulk-actions-bar";

export type OfferRow = {
  id: string;
  enrollmentNumber: string;
  studentName: string;
  studentId: string;
  companyName: string;
  driveTitle: string;
  driveId: string;
  offerType: string;
  totalCompensation: string;
  offerDate: string | null;
  joiningDate: string | null;
  status: string;
};

export function OffersTable({ rows }: { rows: OfferRow[] }) {
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
      {selected.size > 0 && <OffersBulkActionsBar offerIds={[...selected]} onDone={() => setSelected(new Set())} />}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
              <TableHead>Enrollment No.</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Company / Drive</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>CTC</TableHead>
              <TableHead>Offered</TableHead>
              <TableHead>Joining</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => (
              <TableRow key={o.id}>
                <TableCell><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} aria-label={`Select ${o.studentName}`} /></TableCell>
                <TableCell className="font-mono text-xs">{o.enrollmentNumber}</TableCell>
                <TableCell>
                  <Link href={`/offers/${o.id}`} className="font-medium hover:underline">{o.studentName}</Link>
                  <div className="text-muted-foreground text-xs">
                    <Link href={`/students/${o.studentId}`} className="hover:underline">View profile</Link>
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/drives/${o.driveId}`} className="hover:underline">{o.companyName}</Link>
                  <div className="text-muted-foreground text-xs">{o.driveTitle}</div>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">{o.offerType === "PPO" ? "PPO" : o.offerType === "INTERNSHIP" ? "Internship" : "Job"}</TableCell>
                <TableCell className="tabular-nums text-sm">₹{(Number(o.totalCompensation) / 100000).toFixed(1)}L</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{o.offerDate ? new Date(o.offerDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{o.joiningDate ? new Date(o.joiningDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-10 text-center text-sm">No offers match these filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
