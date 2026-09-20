"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Batch = {
  id: string;
  year: number;
  registrationEnabled: boolean;
  loginAllowed: boolean;
  allowDiploma: boolean;
  autoApprovalOnRegistration: boolean;
};

const FIELDS: { key: keyof Batch; label: string }[] = [
  { key: "registrationEnabled", label: "Registration enabled" },
  { key: "loginAllowed", label: "Login allowed" },
  { key: "allowDiploma", label: "Allow diploma" },
  { key: "autoApprovalOnRegistration", label: "Auto-approval on registration" },
];

export function BatchSettingsTable({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newYear, setNewYear] = useState("");

  async function toggle(batch: Batch, field: keyof Batch) {
    const key = `${batch.id}-${field}`;
    setPendingKey(key);
    const res = await fetch(`/api/settings/batches/${batch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !batch[field] }),
    });
    setPendingKey(null);
    if (res.ok) router.refresh();
    else toast.error("Couldn't update batch setting.");
  }

  async function handleAddBatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newYear) return;
    setAdding(true);
    const res = await fetch("/api/settings/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: Number(newYear) }),
    });
    const data = await res.json().catch(() => ({}));
    setAdding(false);
    if (res.ok) {
      setNewYear("");
      toast.success(`Batch ${data.batch?.year ?? ""} added`);
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't add batch.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAddBatch} className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-batch-year" className="text-xs font-medium text-muted-foreground">
            Batch year
          </label>
          <Input
            id="new-batch-year"
            type="number"
            placeholder="e.g. 2028"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="submit" size="sm" disabled={adding || !newYear}>
          <Plus className="size-3.5" /> {adding ? "Adding…" : "Add batch"}
        </Button>
      </form>

      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium">Year</th>
            {FIELDS.map((f) => (
              <th key={f.key} className="py-2 pr-4 font-medium">{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{b.year}</td>
              {FIELDS.map((f) => (
                <td key={f.key} className="py-2 pr-4">
                  <Switch
                    checked={Boolean(b[f.key])}
                    disabled={pendingKey === `${b.id}-${f.key}`}
                    onCheckedChange={() => toggle(b, f.key)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
