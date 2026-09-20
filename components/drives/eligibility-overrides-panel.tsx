"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type OverrideRow = {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNumber: string;
  decision: "ELIGIBLE" | "NOT_ELIGIBLE";
  reason: string;
  createdAt: string;
};

type StudentHit = { id: string; name: string; enrollmentNumber: string };

// Manual per-student exceptions to a drive's eligibility rules. The rules
// themselves are authored in EligibilityPanel; this is the escape hatch for
// the cases they can't express (a 0.05 CGPA miss, a pending backlog the
// department has already cleared). lib/eligibility-runner.ts applies these
// after the rule tree runs, so preview and publish both reflect them.
export function EligibilityOverridesPanel({
  driveId,
  overrides,
  canOverride,
}: {
  driveId: string;
  overrides: OverrideRow[];
  canOverride: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [decision, setDecision] = useState<"ELIGIBLE" | "NOT_ELIGIBLE">("ELIGIBLE");
  const [reason, setReason] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced in the change handler rather than an effect — the typeahead
  // is driven entirely by user input, so there is no external state to sync.
  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(value.trim())}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({ students: [] }));
      setHits(data.students ?? []);
    }, 250);
  }

  function pick(student: StudentHit) {
    setSelected(student);
    setQuery(`${student.name} (${student.enrollmentNumber})`);
    setHits([]);
  }

  async function handleAdd() {
    if (!selected || reason.trim().length < 3) return;
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/eligibility/overrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selected.id, decision, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.message ?? "Couldn't save the override.");
      return;
    }
    toast.success("Override saved. Re-publish the rule to apply it to the frozen results.");
    setSelected(null);
    setQuery("");
    setReason("");
    setHits([]);
    router.refresh();
  }

  async function handleRemove(override: OverrideRow) {
    if (!confirm(`Remove the override for ${override.studentName}? They go back to whatever the rules decide.`)) return;
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/eligibility/overrides/${override.id}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      toast.success("Override removed.");
      router.refresh();
    } else {
      toast.error("Couldn't remove the override.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manual overrides</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Force a specific student in or out, regardless of the rules. Applied on top of the rule result at preview and publish
          time — re-publish the rule after changing these to update the frozen results.
        </p>

        {canOverride && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="relative flex flex-col gap-1.5">
              <Label htmlFor="override-student">Student</Label>
              <Input
                id="override-student"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by name or enrollment number"
                autoComplete="off"
              />
              {hits.length > 0 && (
                <ul className="bg-popover absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border shadow-md">
                  {hits.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => pick(s)}
                        className="hover:bg-accent flex w-full flex-col items-start px-3 py-2 text-left text-sm"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground text-xs">{s.enrollmentNumber}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Decision</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDecision("ELIGIBLE")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                    decision === "ELIGIBLE" ? "border-emerald-600 bg-emerald-600 text-white" : "hover:bg-accent"
                  }`}
                >
                  <UserCheck className="size-3.5" /> Force eligible
                </button>
                <button
                  type="button"
                  onClick={() => setDecision("NOT_ELIGIBLE")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                    decision === "NOT_ELIGIBLE" ? "border-destructive bg-destructive text-white" : "hover:bg-accent"
                  }`}
                >
                  <UserX className="size-3.5" /> Force not eligible
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-reason">Reason</Label>
              <Input
                id="override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this student is an exception"
              />
            </div>

            <Button
              type="button"
              size="sm"
              className="w-fit"
              disabled={pending || !selected || reason.trim().length < 3}
              onClick={handleAdd}
            >
              {pending ? "Saving…" : "Add override"}
            </Button>
          </div>
        )}

        <div className="flex flex-col divide-y">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{o.studentName}</span>
                  <span className="text-muted-foreground text-xs">{o.enrollmentNumber}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.decision === "ELIGIBLE"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {o.decision === "ELIGIBLE" ? "Forced eligible" : "Forced not eligible"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 break-words">{o.reason}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{new Date(o.createdAt).toLocaleDateString("en-IN")}</p>
              </div>
              {canOverride && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => handleRemove(o)}
                  aria-label={`Remove override for ${o.studentName}`}
                >
                  <Trash2 className="text-muted-foreground size-3.5" />
                </Button>
              )}
            </div>
          ))}
          {overrides.length === 0 && <p className="text-muted-foreground text-sm">No manual overrides on this drive.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
