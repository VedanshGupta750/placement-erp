"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function ContactTagsEditor({ contactId, tags, canEdit }: { contactId: string; tags: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  async function saveTags(nextTags: string[]) {
    setPending(true);
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
    } else {
      toast.error("Couldn't update tags.");
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setValue("");
      setAdding(false);
      return;
    }
    setValue("");
    setAdding(false);
    saveTags([...tags, trimmed]);
  }

  function removeTag(tag: string) {
    saveTags(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1">
          {t}
          {canEdit && (
            <button type="button" onClick={() => removeTag(t)} disabled={pending} aria-label={`Remove tag ${t}`} className="hover:text-destructive">
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {canEdit && adding ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!value.trim()) setAdding(false);
          }}
          placeholder="Tag + Enter"
          className="h-6 w-28 px-2 text-xs"
        />
      ) : (
        canEdit && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
          >
            <Plus className="size-3" /> Add tag
          </button>
        )
      )}
      {tags.length === 0 && !canEdit && <span className="text-muted-foreground text-xs">No tags</span>}
    </div>
  );
}
