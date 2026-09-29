"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACADEMIC_FIELD_LABELS, type AcademicRequestField } from "@/lib/validators/academic-request";

export type AcademicRequestRow = {
  id: string;
  field: string;
  currentValue: number | null;
  requestedValue: number;
  reason: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
};

// The TPO-facing half of the approval flow, mounted on the student's own
// Academic tab. Approving is what actually writes the value onto the
// Student row — nothing the student submits takes effect before this.
export function AcademicRequestsPanel({
  studentId,
  requests,
  canReview,
}: {
  studentId: string;
  requests: AcademicRequestRow[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function review(id: string, action: "APPROVE" | "REJECT", label: string) {
    if (action === "APPROVE" && !confirm(`Approve this change? ${label} will be updated on the student's record.`)) return;
    setPendingId(id);
    const res = await fetch(`/api/students/${studentId}/academic-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: notes[id]?.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setPendingId(null);

    if (!res.ok) {
      toast.error(data.message ?? "Couldn't record that decision.");
      return;
    }
    toast.success(action === "APPROVE" ? `Approved by ${data.reviewedBy}.` : "Request rejected.");
    router.refresh();
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  if (requests.length === 0) {
    return <p className="text-muted-foreground text-sm">This student hasn&apos;t requested any academic corrections.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div className="flex max-h-[22rem] flex-col gap-3 overflow-y-auto [scrollbar-width:thin]">
          {pending.map((r) => {
            const label = ACADEMIC_FIELD_LABELS[r.field as AcademicRequestField] ?? r.field;
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium">{label}</span>
                  <span className="tabular-nums">
                    {r.currentValue ?? "—"} <span className="text-muted-foreground">→</span>{" "}
                    <span className="font-semibold">{r.requestedValue}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    requested {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <p className="text-sm break-words">{r.reason}</p>

                {canReview ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Note (optional — shown to the student)"
                      className="bg-background sm:max-w-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={pendingId === r.id} onClick={() => review(r.id, "APPROVE", label)}>
                        <CheckCircle2 className="size-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === r.id}
                        onClick={() => review(r.id, "REJECT", label)}
                      >
                        <XCircle className="size-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    You don&apos;t have permission to approve academic changes.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="max-h-56 divide-y overflow-y-auto rounded-md border [scrollbar-width:thin]">
          {history.map((r) => (
            <div key={r.id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{ACADEMIC_FIELD_LABELS[r.field as AcademicRequestField] ?? r.field}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.currentValue ?? "—"} → {r.requestedValue}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs break-words">{r.reason}</p>
              {r.reviewedByName && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {r.status === "APPROVED" ? "Approved" : "Rejected"} by {r.reviewedByName}
                  {r.reviewedAt ? ` on ${new Date(r.reviewedAt).toLocaleDateString("en-IN")}` : ""}
                  {r.reviewNote ? ` — ${r.reviewNote}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
