"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Criterion = { key: string; label: string };
type Template = { id: string; roundType: string; criteria: Criterion[] };

function slugify(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ScorecardTemplatesManager({ templates, roundTypes }: { templates: Template[]; roundTypes: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roundType, setRoundType] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([{ key: "", label: "" }]);

  function addRow() {
    setCriteria((prev) => [...prev, { key: "", label: "" }]);
  }
  function updateLabel(i: number, label: string) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { key: slugify(label), label } : c)));
  }
  function removeRow(i: number) {
    setCriteria((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function create() {
    const valid = criteria.filter((c) => c.label.trim());
    if (!roundType.trim() || valid.length === 0) return;
    setPending(true);
    const res = await fetch("/api/scorecard-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundType: roundType.trim(), criteria: valid }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Scorecard created.");
      setCreateOpen(false);
      setRoundType("");
      setCriteria([{ key: "", label: "" }]);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't create scorecard.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this scorecard template? Existing evaluations aren't affected.")) return;
    setPending(true);
    const res = await fetch(`/api/scorecard-templates/${id}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) { toast.success("Deleted."); router.refresh(); } else toast.error("Couldn't delete.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Round types without a scorecard here just use a plain overall score.</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}><Plus className="size-3.5" /> New scorecard</DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New scorecard template</DialogTitle></DialogHeader>
            <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
              <Input value={roundType} onChange={(e) => setRoundType(e.target.value)} placeholder="Round type (e.g. Technical, HR, Managerial)" list="round-types" />
              <datalist id="round-types">
                {roundTypes.map((r) => <option key={r} value={r} />)}
              </datalist>
              <div className="flex flex-col gap-2">
                {criteria.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={c.label} onChange={(e) => updateLabel(i, e.target.value)} placeholder="Criterion (e.g. Coding)" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)} aria-label="Remove"><X className="size-3.5" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="size-3.5" /> Add criterion</Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button disabled={pending || !roundType.trim() || criteria.every((c) => !c.label.trim())} onClick={create}>{pending ? "Saving…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t.roundType}</CardTitle>
              <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(t.id)} aria-label="Delete">
                <Trash2 className="text-muted-foreground size-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {t.criteria.map((c) => (
                <span key={c.key} className="bg-muted rounded-full px-2.5 py-1 text-xs">{c.label}</span>
              ))}
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">No scorecard templates yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
