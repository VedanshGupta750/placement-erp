"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, Copy, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MessageUserDialog } from "@/components/network/message-user-dialog";
import { ProfileDialog } from "@/components/network/profile-dialog";

// No online/offline/away indicator here — this app has no presence-
// tracking infra (no heartbeat, no websocket), so a colored dot would be
// permanently fake data, not a real signal that happens to be missing
// sometimes. Left out entirely rather than faked.
export type PersonCardData = {
  id: string;
  name: string;
  userType: string;
  courseLabel: string | null;
  batchYear: number | null;
  departmentName: string | null;
  skills: string[];
  placement:
    | { kind: "placed"; companyName: string; package: string }
    | { kind: "in_process"; activeCount: number }
    | { kind: "not_eligible" }
    | { kind: "eligible" }
    | null;
  studentId: string | null;
  enrollmentNumber: string | null;
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function PlacementBadge({ placement }: { placement: PersonCardData["placement"] }) {
  if (!placement) return null;
  if (placement.kind === "placed") return <Badge className="max-w-full border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><span className="truncate">Placed · {placement.companyName}</span></Badge>;
  if (placement.kind === "in_process") return <Badge className="max-w-full border-none bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">In Process</Badge>;
  if (placement.kind === "not_eligible") return <Badge variant="outline" className="max-w-full">Not Eligible</Badge>;
  return <Badge className="max-w-full border-none bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">Eligible</Badge>;
}

export function PersonCard({
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
    <Card className="min-w-0">
      <CardContent className="flex h-full min-w-0 flex-col gap-3 pt-6">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3 overflow-hidden">
            {onToggleSelect && <Checkbox checked={!!selected} onCheckedChange={onToggleSelect} aria-label={`Select ${person.name}`} className="mt-1 shrink-0" />}
            <Avatar className="ring-border size-10 shrink-0 ring-1">
              <AvatarFallback className="bg-accent text-accent-foreground text-sm">{initials(person.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 overflow-hidden">
              <button type="button" className="block w-full truncate text-left font-medium hover:underline" title={person.name} onClick={() => setProfileOpen(true)}>{person.name}</button>
              <div className="text-muted-foreground text-xs">
                {person.courseLabel ? `Student · ${person.batchYear}` : person.userType.replaceAll("_", " ")}
              </div>
              {person.courseLabel && <div className="text-muted-foreground line-clamp-2 break-words text-xs">{person.courseLabel}</div>}
              {!person.courseLabel && person.departmentName && <div className="text-muted-foreground line-clamp-2 break-words text-xs">{person.departmentName}</div>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7 shrink-0" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>View Profile</DropdownMenuItem>
              {person.studentId && canViewFullProfile && (
                <DropdownMenuItem render={<Link href={`/students/${person.studentId}`} />}>View Placement Profile</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(person.name); toast.success("Copied."); }}>
                <Copy className="size-3.5" /> Copy Name
              </DropdownMenuItem>
              {person.enrollmentNumber && (
                <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(person.enrollmentNumber!); toast.success("Enrollment number copied."); }}>
                  <Copy className="size-3.5" /> Copy Enrollment No.
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {person.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {person.skills.slice(0, 3).map((s) => <Badge key={s} variant="outline" className="max-w-full text-[10px]"><span className="truncate">{s}</span></Badge>)}
            {person.skills.length > 3 && <Badge variant="outline" className="text-[10px]">+{person.skills.length - 3}</Badge>}
          </div>
        )}

        <PlacementBadge placement={person.placement} />

        <div className="mt-auto flex min-w-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" className="min-w-0 flex-1 basis-28 px-1.5 text-xs" onClick={() => setProfileOpen(true)}>
            <UserRound className="size-3.5" /> View Profile
          </Button>
          {!isSelf && (
            <MessageUserDialog userId={person.id} userName={person.name} triggerClassName="min-w-0 flex-1 basis-28 px-1.5 text-xs" />
          )}
        </div>
      </CardContent>

      <ProfileDialog userId={person.id} open={profileOpen} onOpenChange={setProfileOpen} canViewFullProfile={canViewFullProfile} />
    </Card>
  );
}
