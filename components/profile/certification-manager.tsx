"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Certification = {
  id: string;
  name: string;
  issuer: string | null;
  issueDate: string | null;
  credentialUrl: string | null;
};

export function CertificationManager({ items }: { items: Certification[] }) {
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
      name: fd.get("name"),
      issuer: fd.get("issuer") || undefined,
      issueDate: fd.get("issueDate") || undefined,
      credentialUrl: fd.get("credentialUrl") || undefined,
    };
    const res = await fetch("/api/profile/certifications", {
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
    toast.success("Certification added");
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this certification?")) return;
    const res = await fetch(`/api/profile/certifications/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Certification removed");
      router.refresh();
    } else {
      toast.error("Couldn't remove this certification.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {c.name}
              {c.credentialUrl && (
                <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
            <div className="text-muted-foreground text-xs">
              {c.issuer}
              {c.issueDate ? ` · ${new Date(c.issueDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
            </div>
          </div>
          <Button size="icon-sm" variant="ghost" className="text-destructive shrink-0" onClick={() => remove(c.id)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      {items.length === 0 && !adding && <p className="text-muted-foreground text-sm">No certifications added yet.</p>}

      {adding ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issuer">Issuer</Label>
              <Input id="issuer" name="issuer" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input id="issueDate" name="issueDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="credentialUrl">Credential link</Label>
              <Input id="credentialUrl" name="credentialUrl" placeholder="https://..." />
            </div>
          </div>
          {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add certification
        </Button>
      )}
    </div>
  );
}
