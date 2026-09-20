"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

type RecruiterAccount = { id: string; name: string; email: string; status: string; isOwner: boolean; createdAt: string };

// Real login accounts into /employer — distinct from the Contact CRM
// roster above this panel (a Contact can exist with zero portal access,
// or a portal account can belong to someone who's also a Contact; this
// app doesn't currently link the two records, so they're managed
// separately here). No email provider is wired up, so every temp
// password is shown once for the TPO to relay manually — same pattern as
// the staff invite flow and student password reset.
export function PortalAccountsPanel({ companyId, accounts }: { companyId: string; accounts: RecruiterAccount[] }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<RecruiterAccount | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/companies/${companyId}/recruiters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), email: fd.get("email") }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.message ?? "Couldn't create the account.");
      return;
    }
    setTempPassword(data.tempPassword);
  }

  async function resetPassword(account: RecruiterAccount) {
    setPending(true);
    const res = await fetch(`/api/companies/${companyId}/recruiters/${account.id}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setResetTarget(account);
      setTempPassword(data.tempPassword);
    } else {
      toast.error("Couldn't reset the password.");
    }
  }

  async function toggleStatus(account: RecruiterAccount) {
    setPending(true);
    const suspend = account.status !== "SUSPENDED";
    const res = await fetch(`/api/companies/${companyId}/recruiters/${account.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspend }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(suspend ? "Account suspended." : "Account reactivated.");
      router.refresh();
    } else {
      toast.error("Couldn't update the account.");
    }
  }

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  function closeDialogs() {
    setInviteOpen(false);
    setResetTarget(null);
    setTempPassword(null);
    setError(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Portal accounts</h3>
          <p className="text-muted-foreground text-xs">Real login credentials into the recruiter portal, separate from the contact list above.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="size-3.5" /> Grant portal access
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No recruiter has portal access yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {a.name}
                    {a.isOwner && <Badge variant="outline">Owner</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{a.email}</TableCell>
                <TableCell>
                  <Badge variant={a.status === "ACTIVE" ? "default" : "outline"} className={a.status === "ACTIVE" ? "bg-emerald-600" : ""}>
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => resetPassword(a)}>
                      <KeyRound className="size-3.5" /> Reset password
                    </Button>
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => toggleStatus(a)}>
                      {a.status === "SUSPENDED" ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
                      {a.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={inviteOpen} onOpenChange={(open) => (open ? setInviteOpen(true) : closeDialogs())}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Grant recruiter portal access</DialogTitle></DialogHeader>
          {!tempPassword ? (
            <form onSubmit={invite} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recruiter-name">Name</Label>
                <Input id="recruiter-name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recruiter-email">Work email</Label>
                <Input id="recruiter-email" name="email" type="email" required />
              </div>
              {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
              <p className="text-muted-foreground text-xs">
                No email provider is configured — you&apos;ll get a temporary password to share with them yourself.
              </p>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">Share this with them now — it won&apos;t be shown again.</p>
              <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 font-mono text-sm">
                {tempPassword}
                <Button type="button" variant="ghost" size="icon-sm" onClick={copyPassword}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeDialogs}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Password reset — {resetTarget?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">Share this with them now — it won&apos;t be shown again.</p>
            {tempPassword && (
              <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 font-mono text-sm">
                {tempPassword}
                <Button type="button" variant="ghost" size="icon-sm" onClick={copyPassword}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button onClick={closeDialogs}>Done</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
