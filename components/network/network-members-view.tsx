"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PersonCard, type PersonCardData } from "@/components/network/person-card";
import { PersonListRow } from "@/components/network/person-list-row";
import { NetworkBulkActionsBar } from "@/components/network/network-bulk-actions-bar";
import { CardGrid } from "@/components/network/card-grid";

export function NetworkMembersView({
  members,
  view,
  currentUserId,
  canBulkSelect,
  canViewFullProfile,
}: {
  members: PersonCardData[];
  view: "grid" | "list";
  currentUserId: string;
  canBulkSelect: boolean;
  canViewFullProfile: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectableIds = members.filter((m) => m.id !== currentUserId).map((m) => m.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  return (
    <div className="flex flex-col gap-3">
      {canBulkSelect && selected.size > 0 && (
        <NetworkBulkActionsBar userIds={[...selected]} onDone={() => setSelected(new Set())} />
      )}

      {view === "grid" ? (
        <CardGrid>
          {members.map((m) => (
            <PersonCard
              key={m.id}
              person={m}
              currentUserId={currentUserId}
              canViewFullProfile={canViewFullProfile}
              selected={selected.has(m.id)}
              onToggleSelect={canBulkSelect && m.id !== currentUserId ? () => toggle(m.id) : undefined}
            />
          ))}
          {members.length === 0 && <p className="text-muted-foreground col-span-full py-10 text-center text-sm">No members match these filters.</p>}
        </CardGrid>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">{canBulkSelect && selectableIds.length > 0 && <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />}</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Course / Dept</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <PersonListRow
                  key={m.id}
                  person={m}
                  currentUserId={currentUserId}
                  canViewFullProfile={canViewFullProfile}
                  selected={selected.has(m.id)}
                  onToggleSelect={canBulkSelect && m.id !== currentUserId ? () => toggle(m.id) : undefined}
                />
              ))}
              {members.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">No members match these filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
