"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function TagsEditor({ studentId, tags, canEdit }: { studentId: string; tags: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  async function updateTags(next: string[]) {
    setPending(true);
    const res = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: next }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error("Couldn't update tags.");
    }
  }

  function addTag() {
    const tag = value.trim();
    if (!tag || tags.includes(tag)) return;
    setValue("");
    updateTags([...tags, tag]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <Badge key={t} variant="outline" className="gap-1">
          {t}
          {canEdit && (
            <button type="button" disabled={pending} onClick={() => updateTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {tags.length === 0 && <span className="text-muted-foreground text-xs">No tags yet.</span>}
      {canEdit && (
        <div className="flex items-center gap-1">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tag…"
            className="h-6 w-28 px-2 text-xs"
          />
          <button type="button" disabled={pending || !value.trim()} onClick={addTag} className="text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
