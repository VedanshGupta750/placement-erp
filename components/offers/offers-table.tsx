"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { OffersBulkActionsBar } from "@/components/offers/offers-bulk-actions-bar";
import { MarkPlacedButton } from "@/components/offers/mark-placed-button";

export type OfferRow = {
  id: string;
  enrollmentNumber: string;
  studentName: string;
  studentId: string;
  companyName: string;
  /** Null for an off-campus placement — there was no drive. */
  driveTitle: string | null;
  driveId: string | null;
  offerType: string;
  totalCompensation: string;
  offerDate: string | null;
  joiningDate: string | null;
  status: string;
  /** CAMPUS | OFF_CAMPUS. Off-campus rows carry no drive and no bulk actions. */
  source?: "CAMPUS" | "OFF_CAMPUS";
  /** Has a staff member confirmed this student placed? */
  studentPlaced?: boolean;
};

export function OffersTable({ rows }: { rows: OfferRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Bulk actions PATCH /api/offers/*, which an off-campus placement is not
  // — so those rows are deliberately unselectable rather than selectable
  // and then silently skipped.
  const selectableRows = rows.filter((r) => r.source !== "OFF_CAMPUS");
  const allSelected = selectableRows.length > 0 && selected.size === selectableRows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableRows.map((r) => r.id)));
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
              <TableHead className="w-8"><Checkbox checked={allSelected} disabled={selectableRows.length === 0} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
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
                <TableCell>
                  {o.source === "OFF_CAMPUS" ? (
                    <span className="sr-only">Off-campus placements can&apos;t be bulk-edited</span>
                  ) : (
                    <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} aria-label={`Select ${o.studentName}`} />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{o.enrollmentNumber}</TableCell>
                <TableCell>
                  {o.source === "OFF_CAMPUS" ? (
                    <Link href={`/students/${o.studentId}?tab=offers`} className="font-medium hover:underline">
                      {o.studentName}
                    </Link>
                  ) : (
                    <Link href={`/offers/${o.id}`} className="font-medium hover:underline">{o.studentName}</Link>
                  )}
                  <div className="text-muted-foreground text-xs">
                    <Link href={`/students/${o.studentId}`} className="hover:underline">View profile</Link>
                  </div>
                </TableCell>
                <TableCell>
                  {o.driveId ? (
                    <Link href={`/drives/${o.driveId}`} className="hover:underline">{o.companyName}</Link>
                  ) : (
                    <span>{o.companyName}</span>
                  )}
                  <div className="text-muted-foreground text-xs">
                    {o.driveTitle ?? "Found by the student"}
                  </div>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  <div className="flex flex-col items-start gap-1">
                    <span>{o.offerType === "PPO" ? "PPO" : o.offerType === "INTERNSHIP" ? "Internship" : "Job"}</span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-sm whitespace-nowrap">
                  {/* An off-campus internship stores a MONTHLY stipend, not
                      an annual CTC. Running it through the lakhs formatter
                      turned ₹30,000/mo into "₹0.3L", which reads like a
                      derisory annual package. */}
                  {Number(o.totalCompensation) <= 0
                    ? "—"
                    : o.source === "OFF_CAMPUS" && o.offerType === "INTERNSHIP"
                      ? `₹${Number(o.totalCompensation).toLocaleString("en-IN")}/mo`
                      : `₹${(Number(o.totalCompensation) / 100000).toFixed(1)}L`}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{o.offerDate ? new Date(o.offerDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{o.joiningDate ? new Date(o.joiningDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={o.status} />
                    {/* Route and placement state live together here, because
                        "off-campus internship, not yet marked placed" is one
                        thought and a TPO scans this column for it. */}
                    {o.source === "OFF_CAMPUS" && (
                      <Badge
                        variant="outline"
                        className="border-violet-300 text-xs whitespace-nowrap text-violet-700 dark:border-violet-500/40 dark:text-violet-400"
                      >
                        Off-campus {o.offerType === "INTERNSHIP" ? "internship" : "job"}
                      </Badge>
                    )}
                    {o.source === "OFF_CAMPUS" &&
                      (o.studentPlaced ? (
                        <Badge className="border-none bg-emerald-100 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                          Marked placed
                        </Badge>
                      ) : (
                        <MarkPlacedButton studentId={o.studentId} studentName={o.studentName} companyName={o.companyName} />
                      ))}
                  </div>
                </TableCell>
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
