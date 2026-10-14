"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MultiSelectOption = { value: string; label: string };

// A checkbox list for filters that should accept several values at once.
//
// Deliberately NOT a nested popover: this already lives inside the filter
// popover, and stacking two means the inner one steals the outer one's
// dismiss and the whole panel closes on the first click. An inline
// scrollable list behaves predictably and makes "Select all" obvious, which
// a single-select dropdown can't express at all.
//
// Emits one hidden input holding comma-joined values, so the surrounding
// uncontrolled <form> keeps working with FormData and the server can read a
// single query parameter.
export function MultiSelectFilter({
  label,
  name,
  options,
  initialSelected = [],
  searchable = false,
  maxHeightClass = "max-h-40",
}: {
  label: string;
  name: string;
  options: MultiSelectOption[];
  initialSelected?: string[];
  /** Adds a filter box — worth it past ~15 options (drives, companies). */
  searchable?: boolean;
  maxHeightClass?: string;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // "Select all" acts on what's VISIBLE, so searching then selecting all
  // does what it looks like it does rather than quietly selecting hidden
  // options too.
  const visibleValues = visible.map((o) => o.value);
  const allVisibleSelected = visibleValues.length > 0 && visibleValues.every((v) => selected.includes(v));

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function toggleAllVisible() {
    setSelected((prev) =>
      allVisibleSelected ? prev.filter((v) => !visibleValues.includes(v)) : [...new Set([...prev, ...visibleValues])],
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>
          {label}
          {selected.length > 0 && <span className="text-muted-foreground font-normal"> · {selected.length} selected</span>}
        </Label>
        <div className="flex items-center gap-2 text-xs">
          <button type="button" onClick={toggleAllVisible} className="text-primary hover:underline">
            {allVisibleSelected ? "Clear" : "Select all"}
          </button>
        </div>
      </div>

      {/* The value the form actually submits. */}
      <input type="hidden" name={name} value={selected.join(",")} />

      <div className="rounded-md border">
        {searchable && (
          <div className="relative border-b p-1.5">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-8 pl-7 text-sm"
              // Enter inside a filter box should narrow the list, not submit
              // the whole form with a half-made selection.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>
        )}

        <div className={`${maxHeightClass} overflow-y-auto p-1.5`}>
          {visible.length === 0 && (
            <p className="text-muted-foreground px-1 py-2 text-xs">No matches.</p>
          )}
          {visible.map((o) => (
            <label
              key={o.value}
              className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm"
            >
              <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
