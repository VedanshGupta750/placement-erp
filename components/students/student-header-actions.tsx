"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, MessageSquare, Briefcase, MoreHorizontal, Link2, UserX, UserCheck, KeyRound, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type Drive = { id: string; title: string; companyName: string; positions: { id: string; title: string }[] };

export function StudentHeaderActions({
  studentId,
  studentName,
  recipientUserId,
  canEdit,
  canAddToDrive,
  canMessage,
  canDelete,
  initial,
  drives,
  accountStatus,
}: {
  studentId: string;
  studentName: string;
  recipientUserId: string;
  canEdit: boolean;
  canAddToDrive: boolean;
  canMessage: boolean;
  canDelete: boolean;
  initial: { placementStatus: string; eligibleForPlacements: boolean; interestedInJobs: boolean; interestedInInternships: boolean };
  drives: Drive[];
  accountStatus: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConsequences, setDeleteConsequences] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const isSuspended = accountStatus === "SUSPENDED";

  const [placementStatus, setPlacementStatus] = useState(initial.placementStatus);
  const [eligible, setEligible] = useState(initial.eligibleForPlacements);
  const [interestedJobs, setInterestedJobs] = useState(initial.interestedInJobs);
  const [interestedInternships, setInterestedInternships] = useState(initial.interestedInInternships);

  const [msgBody, setMsgBody] = useState("");

  const [driveId, setDriveId] = useState("");
  const [positionId, setPositionId] = useState("");
  const selectedDrive = drives.find((d) => d.id === driveId);

  async function saveEdit() {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementStatus,
        eligibleForPlacements: eligible,
        interestedInJobs: interestedJobs,
        interestedInInternships: interestedInternships,
      }),
    });
    setPending(false);
    if (res.ok) {
      setEditOpen(false);
      toast.success("Profile updated.");
      router.refresh();
    } else {
      toast.error("Couldn't update profile.");
    }
  }

  async function sendMessage() {
    if (!msgBody.trim()) return;
    setPending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUserId, body: msgBody.trim() }),
    });
    setPending(false);
    if (res.ok) {
      setMsgOpen(false);
      setMsgBody("");
      toast.success("Message sent.");
    } else {
      toast.error("Couldn't send message.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Profile link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function resetPassword() {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setTempPassword(data.tempPassword);
      toast.success("Password reset — share the new password with the student.");
    } else {
      toast.error("Couldn't reset the password.");
    }
  }

  async function copyTempPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  async function toggleAccountStatus() {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/account-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspend: !isSuspended }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(isSuspended ? "Account reactivated." : "Account suspended.");
      router.refresh();
    } else {
      toast.error("Couldn't update the account.");
    }
  }

  // The counts are fetched before the dialog opens so the warning always
  // states the real blast radius rather than a generic "this can't be
  // undone" — see /api/students/[id]/deletion-impact.
  async function openDelete() {
    setDeleteConsequences(undefined);
    const res = await fetch(`/api/students/${studentId}/deletion-impact`);
    if (!res.ok) {
      toast.error("Couldn't check what deleting this student would affect.");
      return;
    }
    const { impact } = await res.json();
    const parts = [
      impact.applications > 0 ? `${impact.applications} application${impact.applications === 1 ? "" : "s"}` : null,
      impact.offers > 0 ? `${impact.offers} offer${impact.offers === 1 ? "" : "s"}` : null,
      impact.interviewRecords > 0
        ? `${impact.interviewRecords} interview record${impact.interviewRecords === 1 ? "" : "s"}`
        : null,
      impact.resumes > 0 ? `${impact.resumes} resume${impact.resumes === 1 ? "" : "s"}` : null,
      impact.documents > 0 ? `${impact.documents} document${impact.documents === 1 ? "" : "s"}` : null,
      impact.notes > 0 ? `${impact.notes} note${impact.notes === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const tail = "Their login account is removed too, so they lose access immediately. This can't be undone.";
    setDeleteConsequences(
      parts.length === 0
        ? `No applications, offers or documents are attached. ${tail}`
        : `This also permanently deletes ${parts.join(", ")}. ${tail}`,
    );
    setDeleteOpen(true);
  }

  async function deleteStudent() {
    const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // delete_blocked is a refusal with a reason, not a generic failure.
      toast.error(data.message ?? "Couldn't delete this student.");
      return;
    }
    setDeleteOpen(false);
    // This lives on the student's own page, so refreshing in place would
    // re-render a record that no longer exists. Go back to the roster.
    toast.success(`${studentName} deleted.`);
    router.push("/students");
    router.refresh();
  }

  async function addToDrive() {
    if (!driveId || !positionId) return;
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driveId, positionId }),
    });
    setPending(false);
    if (res.ok) {
      setDriveOpen(false);
      setDriveId("");
      setPositionId("");
      toast.success("Added to drive.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't add to drive.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Edit placement policy</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Placement status</Label>
                  <Select value={placementStatus} onValueChange={(v) => v && setPlacementStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEEKING">Seeking</SelectItem>
                      <SelectItem value="PLACED">Placed</SelectItem>
                      <SelectItem value="NOT_INTERESTED">Not interested</SelectItem>
                      <SelectItem value="OPTED_OUT">Opted out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={eligible} onCheckedChange={(v) => setEligible(v === true)} /> Eligible for placements
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={interestedJobs} onCheckedChange={(v) => setInterestedJobs(v === true)} /> Interested in jobs
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={interestedInternships} onCheckedChange={(v) => setInterestedInternships(v === true)} /> Interested in internships
                </label>
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button disabled={pending} onClick={saveEdit}>{pending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canMessage && (
        <>
          <Button variant="outline" size="sm" onClick={() => setMsgOpen(true)}>
            <MessageSquare className="size-3.5" /> Message
          </Button>
          <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Message student</DialogTitle></DialogHeader>
              <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Type your message…" rows={4} />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button disabled={pending || !msgBody.trim()} onClick={sendMessage}>{pending ? "Sending…" : "Send"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canAddToDrive && (
        <>
          <Button variant="outline" size="sm" onClick={() => setDriveOpen(true)}>
            <Briefcase className="size-3.5" /> Add to Drive
          </Button>
          <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add to drive</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Drive</Label>
                  <Select value={driveId} onValueChange={(v) => { if (v) { setDriveId(v); setPositionId(""); } }}>
                    <SelectTrigger><SelectValue placeholder="Select a drive" /></SelectTrigger>
                    <SelectContent>
                      {drives.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.companyName} — {d.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedDrive && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Position</Label>
                    <Select value={positionId} onValueChange={(v) => v && setPositionId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select a position" /></SelectTrigger>
                      <SelectContent>
                        {selectedDrive.positions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button disabled={pending || !driveId || !positionId} onClick={addToDrive}>{pending ? "Adding…" : "Add"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="size-3.5" /> Copy profile link
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem
              onClick={() => {
                setTempPassword(null);
                setResetPwOpen(true);
              }}
            >
              <KeyRound className="size-3.5" /> Reset password
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onClick={toggleAccountStatus} disabled={pending} variant={isSuspended ? undefined : "destructive"}>
              {isSuspended ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
              {isSuspended ? "Reactivate account" : "Suspend account"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem onClick={openDelete} disabled={pending} variant="destructive">
              <Trash2 className="size-3.5" /> Delete student
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          itemKind="student"
          itemName={studentName}
          consequences={deleteConsequences}
          onConfirm={deleteStudent}
        />
      )}

      {canEdit && (
        <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Reset student password</DialogTitle></DialogHeader>
            {!tempPassword ? (
              <p className="text-muted-foreground text-sm">
                This generates a new temporary password and immediately replaces their current one. There&apos;s no
                email provider configured yet, so you&apos;ll need to share it with the student yourself (call,
                message, in person).
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-sm">
                  Share this with the student now — it won&apos;t be shown again. They can change it after signing in
                  from their profile.
                </p>
                <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 font-mono text-sm">
                  {tempPassword}
                  <Button type="button" variant="ghost" size="icon-sm" onClick={copyTempPassword}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              {!tempPassword ? (
                <>
                  <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                  <Button disabled={pending} onClick={resetPassword}>{pending ? "Resetting…" : "Reset password"}</Button>
                </>
              ) : (
                <DialogClose render={<Button type="button" />}>Done</DialogClose>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
