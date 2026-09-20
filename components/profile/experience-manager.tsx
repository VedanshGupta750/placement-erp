"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Experience = {
  id: string;
  organisation: string;
  role: string;
  experienceType: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
};

export function ExperienceManager({ items }: { items: Experience[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      organisation: fd.get("organisation"),
      role: fd.get("role"),
      experienceType: fd.get("experienceType") || undefined,
      startDate: fd.get("startDate") || undefined,
      endDate: fd.get("endDate") || undefined,
      description: fd.get("description") || undefined,
    };
    const res = await fetch("/api/profile/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? Object.values(data.fieldErrors ?? {}).flat()[0] as string ?? "Something went wrong.");
      return;
    }
    toast.success("Experience added");
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this experience?")) return;
    const res = await fetch(`/api/profile/experiences/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Experience removed");
      router.refresh();
    } else {
      toast.error("Couldn't remove this experience.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((exp) => (
        <div key={exp.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">{exp.role} · {exp.organisation}</div>
            <div className="text-muted-foreground text-xs">
              {exp.experienceType ? `${exp.experienceType} · ` : ""}
              {exp.startDate ? new Date(exp.startDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""}
              {exp.endDate ? ` – ${new Date(exp.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : exp.startDate ? " – Present" : ""}
            </div>
            {exp.description && <p className="mt-1 text-sm">{exp.description}</p>}
          </div>
          <Button size="icon-sm" variant="ghost" className="text-destructive shrink-0" onClick={() => remove(exp.id)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      {items.length === 0 && !adding && <p className="text-muted-foreground text-sm">No experience added yet.</p>}

      {adding ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organisation">Organisation *</Label>
              <Input id="organisation" name="organisation" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role *</Label>
              <Input id="role" name="role" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experienceType">Type</Label>
              <Input id="experienceType" name="experienceType" placeholder="Internship / Full-time" />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="startDate">Start</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="endDate">End</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add experience
        </Button>
      )}
    </div>
  );
}
