"use client";

import { useEffect, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export type EventSpeakerLite = {
  id: string;
  name: string;
  designation: string | null;
  organization: string | null;
  email?: string | null;
  bio?: string | null;
  sessionCount?: number;
};

// Used inside the Create/Edit Event wizard's Speaker step — either pick an
// existing EventSpeaker (debounced search against GET /api/event-speakers)
// or create a new one inline (POST /api/event-speakers), same
// search-then-create shape as NewMessageDialog's people picker.
export function SpeakerPicker({
  value,
  onChange,
}: {
  value: EventSpeakerLite | null;
  onChange: (speaker: EventSpeakerLite | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventSpeakerLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSpeaker, setNewSpeaker] = useState({ name: "", designation: "", organization: "", email: "", bio: "" });

  useEffect(() => {
    if (value || showNewForm) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/event-speakers?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.speakers ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, value, showNewForm]);

  async function handleCreate() {
    if (!newSpeaker.name.trim()) {
      toast.error("Speaker name is required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/event-speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSpeaker),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Couldn't create speaker.");
        return;
      }
      onChange(data.speaker);
      setShowNewForm(false);
      setNewSpeaker({ name: "", designation: "", organization: "", email: "", bio: "" });
    } finally {
      setCreating(false);
    }
  }

  if (value) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-4">
          <div className="min-w-0">
            <div className="font-medium">{value.name}</div>
            <div className="text-muted-foreground text-sm">
              {[value.designation, value.organization].filter(Boolean).join(", ") || "No details on file"}
              {!!value.sessionCount && ` · ${value.sessionCount} previous session${value.sessionCount === 1 ? "" : "s"}`}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            <X className="size-3.5" /> Change
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!showNewForm && (
        <>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input className="pl-8" placeholder="Search speakers by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {searching && <p className="text-muted-foreground text-sm">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="text-muted-foreground text-sm">{query.trim() ? "No speakers found." : "No speakers on file yet."}</p>
            )}
            {results.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => onChange(s)}
                className="hover:bg-accent/40 flex flex-col items-start rounded-md border p-2 text-left text-sm transition-colors"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[s.designation, s.organization].filter(Boolean).join(", ") || "—"}
                  {!!s.sessionCount && ` · ${s.sessionCount} session${s.sessionCount === 1 ? "" : "s"}`}
                </span>
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setShowNewForm(true)}>
            <Plus className="size-3.5" /> Add a new speaker
          </Button>
        </>
      )}

      {showNewForm && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speaker-name">Name</Label>
              <Input id="speaker-name" value={newSpeaker.name} onChange={(e) => setNewSpeaker((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speaker-designation">Designation</Label>
              <Input id="speaker-designation" value={newSpeaker.designation} onChange={(e) => setNewSpeaker((s) => ({ ...s, designation: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speaker-org">Organization</Label>
              <Input id="speaker-org" value={newSpeaker.organization} onChange={(e) => setNewSpeaker((s) => ({ ...s, organization: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speaker-email">Email</Label>
              <Input id="speaker-email" type="email" value={newSpeaker.email} onChange={(e) => setNewSpeaker((s) => ({ ...s, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="speaker-bio">Bio</Label>
            <Textarea id="speaker-bio" rows={2} value={newSpeaker.bio} onChange={(e) => setNewSpeaker((s) => ({ ...s, bio: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowNewForm(false)}>Cancel</Button>
            <Button type="button" size="sm" disabled={creating} onClick={handleCreate}>{creating ? "Adding…" : "Add speaker"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
