"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tag, RefreshCw, MessageSquare, Download, X, GitCompare, UserCog, FolderDown, Briefcase, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Coordinator = { id: string; name: string; title: string; departmentName: string };
type Drive = { id: string; title: string; companyName: string; positions: { id: string; title: string }[] };

export function BulkActionsBar({
  studentIds,
  onDone,
  canEdit,
  selectableCount,
  onSelectAll,
}: {
  studentIds: string[];
  onDone: () => void;
  canEdit: boolean;
  /** Rows currently loaded, for the "select all N" shortcut. */
  selectableCount: number;
  onSelectAll: () => void;
}) {
  const router = useRouter();
  const [tagOpen, setTagOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [coordOpen, setCoordOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("PLACED");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [driveId, setDriveId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [pending, setPending] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  useEffect(() => {
    if (!coordOpen || coordinators.length > 0) return;
    fetch("/api/students/coordinators")
      .then((r) => r.json())
      .then((data) => setCoordinators(data.coordinators ?? []));
  }, [coordOpen, coordinators.length]);

  useEffect(() => {
    if (!driveOpen || drives.length > 0) return;
    fetch("/api/drives")
      .then((r) => r.json())
      .then((data) => setDrives(data.drives ?? []));
  }, [driveOpen, drives.length]);

  const selectedDrive = drives.find((d) => d.id === driveId);

  async function run(action: string, payload: Record<string, unknown>) {
    setPending(true);
    const res = await fetch("/api/students/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds, action, payload }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Applied to ${data.successCount} student${data.successCount === 1 ? "" : "s"}.`);
      onDone();
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    toast.error(data.message ?? "Bulk action failed.");
    return false;
  }

  return (
    <div className="bg-accent/60 flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-medium">{studentIds.length} selected</span>
        {studentIds.length < selectableCount && (
          <button type="button" onClick={onSelectAll} className="text-primary text-xs hover:underline">
            Select all {selectableCount}
          </button>
        )}
      </div>
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:ml-auto sm:pb-0">
        <Dialog open={tagOpen} onOpenChange={setTagOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Tag className="size-3.5" /> Add tag
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add tag to {studentIds.length} students</DialogTitle></DialogHeader>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Top Performer" />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending || !tag.trim()} onClick={async () => { if (await run("add_tag", { tag: tag.trim() })) { setTagOpen(false); setTag(""); } }}>
                {pending ? "Applying…" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <RefreshCw className="size-3.5" /> Change status
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Change placement status for {studentIds.length} students</DialogTitle></DialogHeader>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEEKING">Seeking</SelectItem>
                <SelectItem value="PLACED">Placed</SelectItem>
                <SelectItem value="NOT_INTERESTED">Not interested</SelectItem>
                <SelectItem value="OPTED_OUT">Opted out</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending} onClick={async () => { if (await run("change_status", { placementStatus: status })) setStatusOpen(false); }}>
                {pending ? "Applying…" : "Change"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <MessageSquare className="size-3.5" /> Send message
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Notify {studentIds.length} students</DialogTitle></DialogHeader>
            <Input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} placeholder="Title" />
            <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Message" rows={3} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={pending || !msgTitle.trim() || !msgBody.trim()}
                onClick={async () => {
                  if (await run("send_message", { title: msgTitle.trim(), body: msgBody.trim() })) {
                    setMessageOpen(false);
                    setMsgTitle("");
                    setMsgBody("");
                  }
                }}
              >
                {pending ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={coordOpen} onOpenChange={setCoordOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <UserCog className="size-3.5" /> Assign coordinator
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Assign a coordinator to {studentIds.length} students</DialogTitle></DialogHeader>
            <Select value={coordinatorId} onValueChange={(v) => v && setCoordinatorId(v)}>
              <SelectTrigger><SelectValue placeholder={coordinators.length === 0 ? "Loading…" : "Select a coordinator"} /></SelectTrigger>
              <SelectContent>
                {coordinators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} — {c.title}, {c.departmentName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending || !coordinatorId} onClick={async () => { if (await run("assign_coordinator", { coordinatorId })) { setCoordOpen(false); setCoordinatorId(""); } }}>
                {pending ? "Assigning…" : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Briefcase className="size-3.5" /> Add to Drive
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add {studentIds.length} students to a drive</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-3">
              <Select value={driveId} onValueChange={(v) => { if (v) { setDriveId(v); setPositionId(""); } }}>
                <SelectTrigger><SelectValue placeholder={drives.length === 0 ? "Loading…" : "Select a drive"} /></SelectTrigger>
                <SelectContent>
                  {drives.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.companyName} — {d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDrive && (
                <Select value={positionId} onValueChange={(v) => v && setPositionId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select a position" /></SelectTrigger>
                  <SelectContent>
                    {selectedDrive.positions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-muted-foreground text-xs">Students already applied to this position are skipped. Eligibility isn&apos;t re-checked — this is a manual override.</p>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={pending || !driveId || !positionId}
                onClick={async () => { if (await run("add_to_drive", { driveId, positionId })) { setDriveOpen(false); setDriveId(""); setPositionId(""); } }}
              >
                {pending ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" render={<a href={`/api/students/export?ids=${studentIds.join(",")}`} />}>
          <Download className="size-3.5" /> Export selected
        </Button>

        <Button variant="outline" size="sm" render={<a href={`/api/students/bulk/documents?ids=${studentIds.join(",")}`} />}>
          <FolderDown className="size-3.5" /> Download documents
        </Button>

        {studentIds.length >= 2 && studentIds.length <= 5 && (
          <Button variant="outline" size="sm" render={<Link href={`/students/compare?ids=${studentIds.join(",")}`} />}>
            <GitCompare className="size-3.5" /> Compare
          </Button>
        )}

        {canEdit && (
          <>
            <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <UserX className="size-3.5" /> Suspend
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>
                    Suspend {studentIds.length} student{studentIds.length === 1 ? "" : "s"}?
                  </DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground text-sm">
                  They won&apos;t be able to sign in until the account is reactivated. Their records, applications and
                  offers are untouched, and nothing is sent to them. Reversible at any time.
                </p>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={async () => {
                      if (await run("suspend_accounts", {})) setSuspendOpen(false);
                    }}
                  >
                    {pending ? "Suspending…" : "Suspend accounts"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <UserCheck className="size-3.5" /> Reactivate
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>
                    Reactivate {studentIds.length} student{studentIds.length === 1 ? "" : "s"}?
                  </DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground text-sm">
                  Sign-in access is restored and each student is notified. Students who were already active are
                  unaffected.
                </p>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                  <Button
                    disabled={pending}
                    onClick={async () => {
                      if (await run("reactivate_accounts", {})) setReactivateOpen(false);
                    }}
                  >
                    {pending ? "Reactivating…" : "Reactivate accounts"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
