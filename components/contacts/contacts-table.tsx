"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Mail, Tag, Trash2, UserCog, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RELATIONSHIP_STAGES, RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { cn } from "@/lib/utils";

export type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  companyName: string | null;
  contactType: string | null;
  driveCount: number;
  lastContactText: string;
  followUpText: string;
  followUpClassName: string;
  ownerName: string;
};

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

export function ContactsTable({
  contacts,
  users,
  canManage,
}: {
  contacts: ContactRow[];
  users: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagValue, setTagValue] = useState("");
  const [pending, setPending] = useState(false);
  // Which row's delete is being confirmed — one dialog reused for the whole
  // table rather than one mounted per row.
  const [pendingDelete, setPendingDelete] = useState<ContactRow | null>(null);

  async function handleDelete() {
    if (!pendingDelete) return;
    const res = await fetch(`/api/contacts/${pendingDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete this contact.");
      return;
    }
    toast.success(`${pendingDelete.name ?? "Contact"} deleted.`);
    setPendingDelete(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(pendingDelete.id);
      return next;
    });
    router.refresh();
  }

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkAction(action: "assign_owner" | "set_stage" | "add_tag", value: string) {
    setPending(true);
    const res = await fetch("/api/contacts/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [...selected], action, value }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(`Updated ${selected.size} contact${selected.size === 1 ? "" : "s"}.`);
      setSelected(new Set());
      setTagValue("");
      router.refresh();
    } else {
      toast.error("Bulk update failed.");
    }
  }

  const selectedEmails = contacts.filter((c) => selected.has(c.id) && c.email).map((c) => c.email as string);

  return (
    <div className="flex flex-col gap-3">
      {someSelected && (
        <div className="bg-muted/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>

          <Select<string> onValueChange={(v) => v && runBulkAction("assign_owner", v === "__unassigned__" ? "" : v)} disabled={pending}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <UserCog className="size-3.5" />
              <SelectValue placeholder="Assign owner">
                {(v: string) => (v === "__unassigned__" ? "Unassigned" : (users.find((u) => u.id === v)?.name ?? "Assign owner"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select<string> onValueChange={(v) => v && runBulkAction("set_stage", v)} disabled={pending}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <Workflow className="size-3.5" />
              <SelectValue placeholder="Change stage">
                {(v: string) => RELATIONSHIP_STAGE_LABELS[v as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? "Change stage"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{RELATIONSHIP_STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (tagValue.trim()) runBulkAction("add_tag", tagValue.trim());
            }}
          >
            <Input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="Add tag…"
              className="h-8 w-[130px] text-xs"
              disabled={pending}
            />
            <Button type="submit" size="icon-sm" variant="outline" disabled={pending || !tagValue.trim()}>
              <Tag className="size-3.5" />
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={selectedEmails.length === 0}
            render={<a href={`mailto:?bcc=${encodeURIComponent(selectedEmails.join(","))}`} />}
          >
            <Mail className="size-3.5" /> Email selected ({selectedEmails.length})
          </Button>

          <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <Table className="min-w-[64rem]">
        <TableHeader>
          <TableRow>
            {canManage && (
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
            )}
            <TableHead>Contact</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Drives</TableHead>
            <TableHead>Last Contact</TableHead>
            <TableHead>Follow-up</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
              {canManage && (
                <TableCell>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name ?? "contact"}`} />
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2.5">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="bg-accent text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      {initials(c.name)}
                    </span>
                  )}
                  <div>
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                      {c.name ?? "Unnamed contact"}
                    </Link>
                    <div className="text-muted-foreground text-xs">{c.email || c.phone || "—"}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{c.companyName ?? "—"}</TableCell>
              <TableCell className="text-sm">{c.contactType ?? "—"}</TableCell>
              <TableCell className="tabular-nums text-sm">{c.driveCount}</TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{c.lastContactText}</TableCell>
              <TableCell className={cn("text-sm whitespace-nowrap", c.followUpClassName)}>{c.followUpText}</TableCell>
              <TableCell className="text-sm">{c.ownerName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingDelete(c)}
                      aria-label={`Delete ${c.name ?? "contact"}`}
                    >
                      <Trash2 className="text-muted-foreground size-3.5" />
                    </Button>
                  )}
                  <Link href={`/contacts/${c.id}`} className="text-muted-foreground hover:text-foreground inline-flex">
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {contacts.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 9 : 8} className="text-muted-foreground py-10 text-center text-sm">No contacts match these filters.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        itemKind="contact"
        itemName={pendingDelete?.name ?? "this contact"}
        consequences="Their notes, logged communications, documents and history are removed with them. This can't be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
