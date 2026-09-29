"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Scores = {
  tenthScore: number | null;
  twelfthScore: number | null;
  diplomaScore: number | null;
  aggregate: number | null;
};

// Board scores were display-only on the Academic tab even though
// PATCH /api/students/[id] has always accepted them (behind
// student.view_sensitive). This is the missing control, not a new capability.
export function BoardScoresEditor({ studentId, scores }: { studentId: string; scores: Scores }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState(scores);

  function field(key: keyof Scores) {
    return {
      value: form[key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value === "" ? null : Number(e.target.value) })),
    };
  }

  async function save() {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Sent as null rather than omitted so clearing a wrong value works.
      body: JSON.stringify({
        tenthScore: form.tenthScore,
        twelfthScore: form.twelfthScore,
        diplomaScore: form.diplomaScore,
        aggregate: form.aggregate,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't save the scores.");
      return;
    }
    toast.success("Academic scores updated.");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" /> Edit scores
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-tenth">10th %</Label>
          <Input id="bs-tenth" type="number" step="0.01" min={0} max={100} {...field("tenthScore")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-twelfth">12th %</Label>
          <Input id="bs-twelfth" type="number" step="0.01" min={0} max={100} {...field("twelfthScore")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-diploma">Diploma %</Label>
          <Input id="bs-diploma" type="number" step="0.01" min={0} max={100} {...field("diplomaScore")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-cgpa">CGPA</Label>
          <Input id="bs-cgpa" type="number" step="0.01" min={0} max={10} {...field("aggregate")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save scores"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setForm(scores); setEditing(false); }}>
          <X className="size-3.5" /> Cancel
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Leave a field empty to clear it. Changes are audited and count as verified.
      </p>
    </div>
  );
}
