"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ResetResult = { email: string; name: string; tempPassword: string };

export function ResetTpoButton({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);

  async function handleReset() {
    if (!confirm(`Reset the TPO password for ${collegeName}? Their current password stops working immediately.`)) return;
    setPending(true);
    const res = await fetch(`/api/platform/colleges/${collegeId}/reset-tpo`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.message ?? "Couldn't reset the TPO password.");
      return;
    }
    // Shown in a dialog rather than a toast on purpose: this is the only
    // time the password is ever visible, so it must not auto-dismiss.
    setResult({ email: data.email, name: data.name, tempPassword: data.tempPassword });
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={handleReset}>
        <KeyRound className="size-3.5" /> {pending ? "Resetting…" : "Reset TPO"}
      </Button>

      <Dialog open={result !== null} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                Password reset for <span className="text-foreground font-medium">{result.name}</span> ({result.email}).
              </p>
              <code className="bg-muted rounded-md px-3 py-2 font-mono text-base break-all select-all">
                {result.tempPassword}
              </code>
              <p className="text-muted-foreground text-xs">
                Copy this now — it is shown once and cannot be retrieved again. Send it to the TPO directly and ask them to
                change it after signing in.
              </p>
              <Button size="sm" className="w-fit" onClick={() => setResult(null)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
