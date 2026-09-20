"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Send, Copy, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const NEXT_ACTION: Record<string, { action: string; label: string }[]> = {
  DRAFT: [{ action: "submit_approval", label: "Submit for approval" }, { action: "publish", label: "Publish" }],
  PENDING_APPROVAL: [{ action: "approve", label: "Approve" }],
  APPROVED: [{ action: "publish", label: "Publish" }],
  PUBLISHED: [{ action: "close", label: "Close registration" }, { action: "complete", label: "Mark complete" }],
  REGISTRATION_OPEN: [{ action: "close", label: "Close registration" }],
  REGISTRATION_CLOSED: [{ action: "complete", label: "Mark complete" }],
  SELECTION_ONGOING: [{ action: "complete", label: "Mark complete" }],
};

export function DriveRowActions({ id, status, isTemplate }: { id: string; status: string; isTemplate: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(action: string, label: string) {
    setPending(true);
    const res = await fetch(`/api/drives/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(label);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error === "forbidden" ? "You don't have permission for this action." : "Something went wrong.");
    }
  }

  async function duplicate() {
    setPending(true);
    const res = await fetch(`/api/drives/${id}/duplicate`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Drive duplicated as a new draft.");
      router.push(`/drives/${data.id}`);
    } else {
      toast.error("Couldn't duplicate this drive.");
    }
  }

  async function toggleTemplate() {
    setPending(true);
    const res = await fetch(`/api/drives/${id}/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTemplate: !isTemplate }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(isTemplate ? "Removed from templates." : "Saved as a template.");
      router.refresh();
    } else {
      toast.error("Couldn't update this drive.");
    }
  }

  const nextActions = NEXT_ACTION[status] ?? [];
  const canArchive = !["ARCHIVED", "CANCELLED"].includes(status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" disabled={pending} />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/drives/${id}`} />}>
          <Eye className="size-3.5" /> View drive
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onClick={duplicate}>
          <Copy className="size-3.5" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onClick={toggleTemplate}>
          <LayoutTemplate className="size-3.5" /> {isTemplate ? "Remove from templates" : "Save as template"}
        </DropdownMenuItem>
        {nextActions.length > 0 && <DropdownMenuSeparator />}
        {nextActions.map((a) => (
          <DropdownMenuItem key={a.action} onClick={() => run(a.action, a.label)}>
            <Send className="size-3.5" /> {a.label}
          </DropdownMenuItem>
        ))}
        {canArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => run("archive", "Drive archived")}>
              Archive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
