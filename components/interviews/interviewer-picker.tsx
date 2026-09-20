"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Staff = { id: string; name: string; email: string; userType: string };

// Type to search real staff accounts (Faculty/Management/Placement Team)
// and link one as interviewerId — or just leave free text for an external
// panelist who was never a user in this system (interviewerName only,
// interviewerId stays null). Selecting a match locks in the link; editing
// the text after that clears it back to free-text mode.
export function InterviewerPicker({
  name,
  interviewerId,
  onChange,
}: {
  name: string;
  interviewerId: string | null;
  onChange: (next: { name: string; interviewerId: string | null }) => void;
}) {
  const [hits, setHits] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (interviewerId || name.trim().length < 2) {
      setHits([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/interviews/interviewers?q=${encodeURIComponent(name.trim())}`)
        .then((r) => r.json())
        .then((data) => setHits(data.staff ?? []));
    }, 250);
    return () => clearTimeout(timeout);
  }, [name, interviewerId]);

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label>Interviewer</Label>
      <Input
        value={name}
        onChange={(e) => { onChange({ name: e.target.value, interviewerId: null }); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search staff, or type an external interviewer's name"
      />
      {interviewerId && <p className="text-muted-foreground text-xs">Linked to a staff account — they&apos;ll see this on their own dashboard.</p>}
      {open && hits.length > 0 && (
        <div className="bg-popover absolute top-full z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border shadow-md">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="hover:bg-accent flex w-full flex-col items-start px-3 py-1.5 text-left text-sm"
              onMouseDown={(e) => { e.preventDefault(); onChange({ name: h.name, interviewerId: h.id }); setOpen(false); }}
            >
              <span>{h.name}</span>
              <span className="text-muted-foreground text-xs">{h.email} · {h.userType.replaceAll("_", " ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
