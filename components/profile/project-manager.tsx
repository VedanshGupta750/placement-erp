"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Project = {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  url: string | null;
};

export function ProjectManager({ items }: { items: Project[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const techStack = ((fd.get("techStack") as string) || "").split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      url: fd.get("url") || undefined,
      techStack,
    };
    const res = await fetch("/api/profile/projects", {
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
    toast.success("Project added");
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this project?")) return;
    const res = await fetch(`/api/profile/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Project removed");
      router.refresh();
    } else {
      toast.error("Couldn't remove this project.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((p) => (
        <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {p.title}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
            {p.description && <p className="mt-1 text-sm">{p.description}</p>}
            {p.techStack.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.techStack.map((t) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
              </div>
            )}
          </div>
          <Button size="icon-sm" variant="ghost" className="text-destructive shrink-0" onClick={() => remove(p.id)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      {items.length === 0 && !adding && <p className="text-muted-foreground text-sm">No projects added yet.</p>}

      {adding ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="techStack">Tech stack</Label>
              <Input id="techStack" name="techStack" placeholder="React, PostgreSQL" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="url">Link</Label>
              <Input id="url" name="url" placeholder="https://github.com/..." />
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
          <Plus className="size-3.5" /> Add project
        </Button>
      )}
    </div>
  );
}
