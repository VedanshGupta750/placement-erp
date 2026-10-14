"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CapValues = {
  placementCapEnabled: boolean;
  placementCapMode: string;
  placementCapFloor: string | null;
  placementCapMultiplier: number | null;
  placementCapIncrement: string | null;
  placementCapCrossEnabled: boolean;
  placementCapCrossFloor: string | null;
  placementCapCrossMultiplier: number | null;
  placementCapCrossIncrement: string | null;
};

export type CourseFlag = { id: string; label: string; isTechnical: boolean };

const MODE_LABELS: Record<string, string> = {
  INCREMENT: "Their current package plus a step",
  FIXED_FLOOR: "A fixed minimum package",
  MULTIPLIER: "A multiple of their current package",
};

const lakhs = (v: string | null) => {
  const n = Number(v);
  return v && Number.isFinite(n) ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)}L` : "—";
};

export function PlacementCapForm({ initial, courses }: { initial: CapValues; courses: CourseFlag[] }) {
  const router = useRouter();
  const [v, setV] = useState<CapValues>(initial);
  const [flags, setFlags] = useState<CourseFlag[]>(courses);
  const [pending, setPending] = useState(false);

  const on = v.placementCapEnabled;
  const isFloor = v.placementCapMode === "FIXED_FLOOR";
  const isIncrement = v.placementCapMode === "INCREMENT";

  function num(key: keyof CapValues, raw: string) {
    setV((p) => ({ ...p, [key]: raw.trim() === "" ? null : raw }));
  }

  async function save() {
    setPending(true);
    const res = await fetch("/api/settings/placement-cap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        placementCapMultiplier: v.placementCapMultiplier === null ? null : Number(v.placementCapMultiplier),
        placementCapCrossMultiplier: v.placementCapCrossMultiplier === null ? null : Number(v.placementCapCrossMultiplier),
        technicalCourseIds: flags.filter((c) => c.isTechnical).map((c) => c.id),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      toast.error(data.message ?? fieldMessage ?? "Couldn't save the placement cap.");
      return;
    }
    toast.success("Placement cap saved.");
    router.refresh();
  }

  // A worked example beats a paragraph of explanation — this is the number
  // a TPO actually wants to sanity-check before saving.
  const example = (() => {
    if (!on) return "A confirmed placement closes the student out of all further drives.";
    if (isIncrement) {
      return v.placementCapIncrement
        ? `A student placed at ₹6L may apply to drives offering ${lakhs(String(600000 + Number(v.placementCapIncrement)))} or more. One placed at ₹12L would need ${lakhs(String(1200000 + Number(v.placementCapIncrement)))}.`
        : "Set the step below.";
    }
    if (isFloor) {
      return v.placementCapFloor
        ? `Every placed student may apply to drives offering ${lakhs(v.placementCapFloor)} or more, whatever they currently hold.`
        : "Set a minimum package below.";
    }
    return v.placementCapMultiplier
      ? `A student placed at ₹6L may apply to drives offering ${lakhs(String(600000 * v.placementCapMultiplier))} or more.`
      : "Set a multiplier below.";
  })();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
        <div className="flex min-w-0 gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Scale className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Let placed students keep applying, above a bar</p>
            <p className="text-muted-foreground mt-1 text-sm">
              With this off, confirming a placement closes the student out of every further drive. Turn it on to let
              them keep chasing better offers above a limit you set.
            </p>
          </div>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(c) => setV((p) => ({ ...p, placementCapEnabled: c === true }))}
          aria-label="Enable the placement cap"
        />
      </div>

      <div className={on ? "flex flex-col gap-5" : "pointer-events-none flex flex-col gap-5 opacity-50"}>
        <div className="flex flex-col gap-1.5">
          <Label>The bar is</Label>
          <Select
            value={v.placementCapMode}
            onValueChange={(next) => next && setV((p) => ({ ...p, placementCapMode: next }))}
          >
            <SelectTrigger className="w-full" disabled={!on}>
              <SelectValue>{(val: string) => MODE_LABELS[val] ?? "Select"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INCREMENT">Their current package plus a step</SelectItem>
              <SelectItem value="FIXED_FLOOR">A fixed minimum package</SelectItem>
              <SelectItem value="MULTIPLIER">A multiple of their current package</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isIncrement ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="increment">Step above their current package (₹ per year)</Label>
            <Input
              id="increment"
              type="number"
              min={0}
              step="50000"
              value={v.placementCapIncrement ?? ""}
              onChange={(e) => num("placementCapIncrement", e.target.value)}
              placeholder="e.g. 400000"
              disabled={!on}
            />
            <p className="text-muted-foreground text-xs">
              Currently {lakhs(v.placementCapIncrement)}. The bar moves with each student — someone on a smaller
              package has a smaller bar to clear.
            </p>
          </div>
        ) : isFloor ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="floor">Minimum package to apply (₹ per year)</Label>
            <Input
              id="floor"
              type="number"
              min={0}
              step="10000"
              value={v.placementCapFloor ?? ""}
              onChange={(e) => num("placementCapFloor", e.target.value)}
              placeholder="e.g. 1000000"
              disabled={!on}
            />
            <p className="text-muted-foreground text-xs">Currently {lakhs(v.placementCapFloor)}.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="multiplier">Next offer must be at least this multiple</Label>
            <Input
              id="multiplier"
              type="number"
              min={1}
              step="0.1"
              value={v.placementCapMultiplier ?? ""}
              onChange={(e) =>
                setV((p) => ({ ...p, placementCapMultiplier: e.target.value === "" ? null : Number(e.target.value) }))
              }
              placeholder="e.g. 1.5"
              disabled={!on}
            />
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">A different bar when they crossed fields</p>
              <p className="text-muted-foreground mt-1 text-sm">
                For a technical student who took a non-technical role, or the reverse. Most colleges set a softer bar
                so those students can still chase work in their own field.
              </p>
            </div>
            <Switch
              checked={v.placementCapCrossEnabled}
              onCheckedChange={(c) => setV((p) => ({ ...p, placementCapCrossEnabled: c === true }))}
              disabled={!on}
              aria-label="Different bar when the placement crossed fields"
            />
          </div>

          {v.placementCapCrossEnabled && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cross">
                {isIncrement ? "Step (₹ per year)" : isFloor ? "Minimum package (₹ per year)" : "Multiple"}
              </Label>
              {isIncrement ? (
                <Input
                  id="cross"
                  type="number"
                  min={0}
                  step="50000"
                  value={v.placementCapCrossIncrement ?? ""}
                  onChange={(e) => num("placementCapCrossIncrement", e.target.value)}
                  placeholder="e.g. 200000"
                  disabled={!on}
                />
              ) : isFloor ? (
                <Input
                  id="cross"
                  type="number"
                  min={0}
                  step="10000"
                  value={v.placementCapCrossFloor ?? ""}
                  onChange={(e) => num("placementCapCrossFloor", e.target.value)}
                  placeholder="e.g. 800000"
                  disabled={!on}
                />
              ) : (
                <Input
                  id="cross"
                  type="number"
                  min={1}
                  step="0.1"
                  value={v.placementCapCrossMultiplier ?? ""}
                  onChange={(e) =>
                    setV((p) => ({
                      ...p,
                      placementCapCrossMultiplier: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="e.g. 1.2"
                  disabled={!on}
                />
              )}
              <p className="text-muted-foreground text-xs">Leave blank to use the main bar above.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Which branches count as technical</Label>
          <p className="text-muted-foreground text-xs">
            Used only by the cross-field rule above. A drive is marked technical on its own form.
          </p>
          <div className="max-h-48 overflow-y-auto rounded-md border p-1.5">
            {flags.map((c) => (
              <label key={c.id} className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm">
                <Switch
                  checked={c.isTechnical}
                  onCheckedChange={(next) =>
                    setFlags((prev) => prev.map((x) => (x.id === c.id ? { ...x, isTechnical: next === true } : x)))
                  }
                  disabled={!on}
                />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
              </label>
            ))}
            {flags.length === 0 && <p className="text-muted-foreground px-1 py-2 text-xs">No courses yet.</p>}
          </div>
        </div>
      </div>

      <p className="text-muted-foreground flex gap-2 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        {example}
      </p>

      <div className="flex justify-end">
        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save cap policy"}
        </Button>
      </div>
    </div>
  );
}
