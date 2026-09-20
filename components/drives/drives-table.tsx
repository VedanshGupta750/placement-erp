"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Columns3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DriveRowActions } from "@/components/drives/drive-row-actions";
import { DrivesBulkActionsBar } from "@/components/drives/drives-bulk-actions-bar";

export type DriveRow = {
  id: string;
  companyName: string;
  title: string;
  status: string;
  registrationClosesAt: string | null;
  ctcLabel: string;
  positionType: string;
  driveTypeLabel: string;
  source: string;
  openings: number | null;
  eligibleCount: number;
  applications: number;
  approvedCount: number;
  shortlistedCount: number;
  offers: number;
  isTemplate: boolean;
};

// Column visibility is per-browser (localStorage), not per-user in the DB —
// this is display preference, not data worth syncing across devices, same
// tier of setting as a sidebar collapse state.
const TOGGLEABLE_COLUMNS = [
  { key: "registrationClosesAt", label: "Registration" },
  { key: "ctc", label: "CTC" },
  { key: "positionType", label: "Position type" },
  { key: "driveType", label: "Drive type" },
  { key: "source", label: "Source" },
  { key: "openings", label: "Openings" },
  { key: "eligible", label: "Eligible" },
  { key: "approved", label: "Approved" },
  { key: "shortlisted", label: "Shortlisted" },
] as const;
type ToggleableColumnKey = (typeof TOGGLEABLE_COLUMNS)[number]["key"];
const DEFAULT_VISIBLE: ToggleableColumnKey[] = ["registrationClosesAt", "ctc", "eligible"];
const STORAGE_KEY = "drives-table-columns";

export function DrivesTable({ rows }: { rows: DriveRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Deliberately starts as DEFAULT_VISIBLE on both server and first client
  // render (matching SSR output, no hydration mismatch), then applies the
  // browser's stored preference once mounted — reading localStorage during
  // the render/initializer phase would diverge from the server-rendered
  // column set and produce a hydration error.
  const [visible, setVisible] = useState<Set<ToggleableColumnKey>>(new Set(DEFAULT_VISIBLE));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      setVisible(new Set(JSON.parse(saved)));
    } catch {
      // ignore malformed storage
    }
  }, []);

  function toggleColumn(key: ToggleableColumnKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

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

  const colCount = 6 + visible.size + 1; // checkbox + company + title + status + applied + offers + actions + toggleable

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && <DrivesBulkActionsBar driveIds={[...selected]} onDone={() => setSelected(new Set())} />}
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3 className="size-3.5" /> Columns
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <div className="flex flex-col gap-2">
              {TOGGLEABLE_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={visible.has(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
              <TableHead>Organisation</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              {visible.has("registrationClosesAt") && <TableHead>Registration closes</TableHead>}
              {visible.has("ctc") && <TableHead>CTC</TableHead>}
              {visible.has("positionType") && <TableHead>Position type</TableHead>}
              {visible.has("driveType") && <TableHead>Drive type</TableHead>}
              {visible.has("source") && <TableHead>Source</TableHead>}
              {visible.has("openings") && <TableHead>Openings</TableHead>}
              {visible.has("eligible") && <TableHead>Eligible</TableHead>}
              <TableHead>Applied</TableHead>
              {visible.has("approved") && <TableHead>Approved</TableHead>}
              {visible.has("shortlisted") && <TableHead>Shortlisted</TableHead>}
              <TableHead>Offers</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell><Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleOne(d.id)} aria-label={`Select ${d.title}`} /></TableCell>
                <TableCell className="flex items-center gap-2">
                  <Briefcase className="text-muted-foreground size-4" />
                  {d.companyName}
                </TableCell>
                <TableCell>
                  <Link href={`/drives/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                </TableCell>
                <TableCell><StatusBadge status={d.status} /></TableCell>
                {visible.has("registrationClosesAt") && (
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {d.registrationClosesAt ? new Date(d.registrationClosesAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                  </TableCell>
                )}
                {visible.has("ctc") && <TableCell className="tabular-nums text-sm whitespace-nowrap">{d.ctcLabel}</TableCell>}
                {visible.has("positionType") && <TableCell className="text-sm whitespace-nowrap">{d.positionType}</TableCell>}
                {visible.has("driveType") && <TableCell className="text-sm whitespace-nowrap">{d.driveTypeLabel}</TableCell>}
                {visible.has("source") && <TableCell className="text-sm whitespace-nowrap">{d.source}</TableCell>}
                {visible.has("openings") && <TableCell className="tabular-nums">{d.openings ?? "-"}</TableCell>}
                {visible.has("eligible") && <TableCell className="tabular-nums">{d.eligibleCount}</TableCell>}
                <TableCell className="tabular-nums">{d.applications}</TableCell>
                {visible.has("approved") && <TableCell className="tabular-nums">{d.approvedCount}</TableCell>}
                {visible.has("shortlisted") && <TableCell className="tabular-nums">{d.shortlistedCount}</TableCell>}
                <TableCell className="tabular-nums">{d.offers}</TableCell>
                <TableCell><DriveRowActions id={d.id} status={d.status} isTemplate={d.isTemplate} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-muted-foreground py-10 text-center text-sm">
                  No drives match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
