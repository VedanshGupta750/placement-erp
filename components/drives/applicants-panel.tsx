"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { toast } from "sonner";

type Applicant = {
  id: string;
  studentId: string;
  status: string;
  matchScore: number | null;
  student: { enrollmentNumber: string; user: { name: string } };
  fieldValues?: { value: string; field: { label: string } }[];
};

const NEXT_ACTIONS: Record<string, { action: string; label: string; variant?: "default" | "outline" | "ghost" }[]> = {
  APPLIED: [{ action: "approve", label: "Approve" }, { action: "reject", label: "Reject", variant: "ghost" }],
  COLLEGE_APPROVED: [{ action: "screen", label: "Move to screening" }, { action: "shortlist", label: "Shortlist" }, { action: "reject", label: "Reject", variant: "ghost" }],
  SCREENING: [{ action: "shortlist", label: "Shortlist" }, { action: "reject", label: "Reject", variant: "ghost" }],
  SHORTLISTED: [{ action: "select", label: "Mark selected" }, { action: "reject", label: "Reject", variant: "ghost" }],
  ROUND_IN_PROGRESS: [{ action: "select", label: "Mark selected" }, { action: "reject", label: "Reject", variant: "ghost" }],
};

export function ApplicantsPanel({ driveId, applicants }: { driveId: string; applicants: Applicant[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function act(applicationId: string, action: string) {
    setPendingId(applicationId);
    const res = await fetch(`/api/drives/${driveId}/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPendingId(null);
    if (res.ok) {
      toast.success("Application updated");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error === "forbidden" ? "You don't have permission for this." : "Couldn't update application.");
    }
  }

  if (applicants.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No applications yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y">
      {applicants.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <div>
            <Link href={`/students/${a.studentId}`} className="font-medium hover:underline">
              {a.student.user.name}
            </Link>
            <div className="text-muted-foreground text-xs">
              {a.student.enrollmentNumber}
              {a.matchScore !== null ? ` · ${a.matchScore}% skill match` : ""}
            </div>
            {a.fieldValues && a.fieldValues.length > 0 && (
              <div className="text-muted-foreground mt-0.5 text-xs">
                {a.fieldValues.map((v) => `${v.field.label}: ${v.value}`).join(" · ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={a.status} />
            {(NEXT_ACTIONS[a.status] ?? []).map((na) => (
              <Button
                key={na.action}
                size="sm"
                variant={na.variant ?? "outline"}
                disabled={pendingId === a.id}
                onClick={() => act(a.id, na.action)}
              >
                {na.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
