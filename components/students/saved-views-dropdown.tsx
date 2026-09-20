"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SavedView = { id: string; name: string; filters: Record<string, string> };

export function SavedViewsDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/students/saved-views")
      .then((r) => r.json())
      .then((data) => setViews(data.views ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  function applyView(view: SavedView) {
    const params = new URLSearchParams(view.filters);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  async function saveCurrentView() {
    if (!newName.trim()) return;
    setSaving(true);
    const filters = Object.fromEntries(searchParams.entries());
    const res = await fetch("/api/students/saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), filters }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setViews((prev) => [data.view, ...prev]);
      setNewName("");
      toast.success("View saved.");
    } else {
      toast.error("Couldn't save view.");
    }
  }

  async function deleteView(id: string) {
    const res = await fetch(`/api/students/saved-views/${id}`, { method: "DELETE" });
    if (res.ok) {
      setViews((prev) => prev.filter((v) => v.id !== id));
    } else {
      toast.error("Couldn't delete view.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <Bookmark className="size-3.5" /> Saved Views
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {loading && <p className="text-muted-foreground text-xs">Loading…</p>}
            {!loading && views.length === 0 && <p className="text-muted-foreground text-xs">No saved views yet.</p>}
            {views.map((v) => (
              <div key={v.id} className="hover:bg-accent/50 flex items-center justify-between rounded-md px-1">
                <button type="button" onClick={() => applyView(v)} className="flex-1 truncate py-1 text-left text-sm">
                  {v.name}
                </button>
                <button type="button" onClick={() => deleteView(v.id)} className="text-muted-foreground hover:text-destructive shrink-0 p-1" aria-label={`Delete ${v.name}`}>
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 border-t pt-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Save current filters as…" className="h-7 text-xs" />
            <Button type="button" size="sm" className="h-7 px-2" disabled={saving || !newName.trim()} onClick={saveCurrentView}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
