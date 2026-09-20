"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MessageUserDialog } from "@/components/network/message-user-dialog";
import { ProfileDialog } from "@/components/network/profile-dialog";
import type { PersonCardData } from "@/components/network/person-card";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const PLACEMENT_LABEL: Record<string, string> = { placed: "Placed", in_process: "In Process", not_eligible: "Not Eligible", eligible: "Eligible" };

export function PersonListRow({
  person,
  currentUserId,
  selected,
  onToggleSelect,
  canViewFullProfile,
}: {
  person: PersonCardData;
  currentUserId: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  canViewFullProfile: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const isSelf = person.id === currentUserId;

  return (
    <TableRow>
      <TableCell>{onToggleSelect && <Checkbox checked={!!selected} onCheckedChange={onToggleSelect} aria-label={`Select ${person.name}`} />}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="ring-border size-7 ring-1"><AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials(person.name)}</AvatarFallback></Avatar>
          <button type="button" className="font-medium hover:underline" onClick={() => setProfileOpen(true)}>{person.name}</button>
        </div>
      </TableCell>
      <TableCell className="text-sm">{person.courseLabel ? "Student" : person.userType.replaceAll("_", " ")}</TableCell>
      <TableCell className="text-sm">{person.courseLabel ?? person.departmentName ?? "-"}</TableCell>
      <TableCell className="text-sm">{person.batchYear ?? "-"}</TableCell>
      <TableCell className="text-sm">{person.placement ? PLACEMENT_LABEL[person.placement.kind] : "-"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}>View</Button>
          {!isSelf && <MessageUserDialog userId={person.id} userName={person.name} />}
        </div>
      </TableCell>
      <ProfileDialog userId={person.id} open={profileOpen} onOpenChange={setProfileOpen} canViewFullProfile={canViewFullProfile} />
    </TableRow>
  );
}
