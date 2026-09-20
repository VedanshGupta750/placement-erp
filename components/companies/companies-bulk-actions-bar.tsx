"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitCompare, X, RefreshCw, Tag, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PARTNERSHIP_STATUS_LABELS } from "@/lib/validators/company";

export function CompaniesBulkActionsBar({ companyIds, onDone }: { companyIds: string[]; onDone: () => void }) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [status, setStatus] = useState("ACTIVE");
  const [tag, setTag] = useState("");
  const [pending, setPending] = useState(false);

  async function run(action: string, payload: Record<string, unknown>) {
    setPending(true);
    const res = await fetch("/api/companies/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyIds, action, payload }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Applied to ${data.successCount} compan${data.successCount === 1 ? "y" : "ies"}.`);
      onDone();
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    toast.error(data.message ?? "Bulk action failed.");
    return false;
  }

  return (
    <div className="bg-accent/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <span className="text-sm font-medium">{companyIds.length} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <RefreshCw className="size-3.5" /> Change status
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Change status for {companyIds.length} companies</DialogTitle></DialogHeader>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARTNERSHIP_STATUS_LABELS).filter(([v]) => v !== "BLOCKED").map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending} onClick={async () => { if (await run("change_status", { status })) setStatusOpen(false); }}>
                {pending ? "Applying…" : "Change"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={tagOpen} onOpenChange={setTagOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Tag className="size-3.5" /> Add tag
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add tag to {companyIds.length} companies</DialogTitle></DialogHeader>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. High Priority" />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending || !tag.trim()} onClick={async () => { if (await run("add_tag", { tag: tag.trim() })) { setTagOpen(false); setTag(""); } }}>
                {pending ? "Applying…" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Mark ${companyIds.length} companies as Blacklisted?`)) run("archive", {});
          }}
        >
          <Archive className="size-3.5" /> Archive
        </Button>

        <Button variant="outline" size="sm" render={<a href={`/api/companies/export?ids=${companyIds.join(",")}`} />}>
          Export selected
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={companyIds.length < 2 || companyIds.length > 5}
          render={<Link href={`/companies/compare?ids=${companyIds.join(",")}`} />}
        >
          <GitCompare className="size-3.5" /> Compare
        </Button>

        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
