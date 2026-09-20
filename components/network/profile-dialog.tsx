"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageUserDialog } from "@/components/network/message-user-dialog";

type Profile = {
  id: string;
  name: string;
  userType: string;
  email: string | null;
  phone: string | null;
  student: { id: string; enrollmentNumber: string; courseLabel: string; batchYear: number; departmentName: string | null; skills: string[] } | null;
  departments: { name: string; title: string }[];
  placement:
    | { kind: "placed"; companyName: string; package: string }
    | { kind: "in_process"; activeCount: number }
    | { kind: "not_eligible" }
    | { kind: "eligible" }
    | null;
  counts: { applications: number; interviews: number; offers: number };
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function ProfileDialog({ userId, open, onOpenChange, canViewFullProfile }: { userId: string; open: boolean; onOpenChange: (open: boolean) => void; canViewFullProfile: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!open) return;
    setProfile(null);
    fetch(`/api/network/members/${userId}`)
      .then((r) => r.json())
      .then((data) => setProfile(data));
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Profile</DialogTitle></DialogHeader>
        {!profile ? (
          <div className="text-muted-foreground py-10 text-center text-sm">Loading…</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Avatar className="ring-border size-16 ring-1">
                <AvatarFallback className="bg-accent text-accent-foreground text-lg">{initials(profile.name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{profile.name}</div>
                <div className="text-muted-foreground text-xs">
                  {profile.student ? `Student · ${profile.student.batchYear}` : profile.userType.replaceAll("_", " ")}
                </div>
                {profile.student && <div className="text-muted-foreground text-xs">{profile.student.courseLabel}</div>}
              </div>
            </div>

            {(profile.email || profile.phone) && (
              <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                <div className="text-muted-foreground text-xs font-medium">Contact</div>
                {profile.email && (
                  <button type="button" className="flex items-center gap-2 text-left hover:underline" onClick={() => { navigator.clipboard?.writeText(profile.email!); toast.success("Email copied."); }}>
                    <Mail className="size-3.5" /> {profile.email} <Copy className="size-3 opacity-50" />
                  </button>
                )}
                {profile.phone && (
                  <button type="button" className="flex items-center gap-2 text-left hover:underline" onClick={() => { navigator.clipboard?.writeText(profile.phone!); toast.success("Phone copied."); }}>
                    <Phone className="size-3.5" /> {profile.phone} <Copy className="size-3 opacity-50" />
                  </button>
                )}
              </div>
            )}

            {profile.student && profile.student.skills.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-3">
                <div className="text-muted-foreground text-xs font-medium">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.student.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                </div>
              </div>
            )}

            {profile.departments.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-3 text-sm">
                <div className="text-muted-foreground text-xs font-medium">Roles</div>
                {profile.departments.map((d) => <div key={d.name + d.title}>{d.title} — {d.name}</div>)}
              </div>
            )}

            {profile.placement && (
              <div className="border-t pt-3 text-sm">
                <div className="text-muted-foreground mb-1 text-xs font-medium">Placement</div>
                {profile.placement.kind === "placed" && <div>✓ Placed — {profile.placement.companyName} ({profile.placement.package})</div>}
                {profile.placement.kind === "in_process" && <div>🟡 In Process — {profile.placement.activeCount} active application{profile.placement.activeCount === 1 ? "" : "s"}</div>}
                {profile.placement.kind === "eligible" && <div>🟢 Eligible</div>}
                {profile.placement.kind === "not_eligible" && <div>Not eligible</div>}
              </div>
            )}

            {profile.student && (
              <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-sm">
                <div><div className="font-semibold">{profile.counts.applications}</div><div className="text-muted-foreground text-xs">Applications</div></div>
                <div><div className="font-semibold">{profile.counts.interviews}</div><div className="text-muted-foreground text-xs">Interviews</div></div>
                <div><div className="font-semibold">{profile.counts.offers}</div><div className="text-muted-foreground text-xs">Offers</div></div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          {profile?.student && canViewFullProfile && (
            <Button variant="outline" render={<Link href={`/students/${profile.student.id}`} />}>View Full Profile</Button>
          )}
          {profile && <MessageUserDialog userId={profile.id} userName={profile.name} />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
