"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Reopening asks for a deadline rather than just flipping the status.
// /api/applications rejects on BOTH drive.status and registrationClosesAt,
// so a drive reopened with a date still in the past would look open to
// students and refuse every application with "registration has closed".
export function ReopenDriveDialog({ driveId, closedAt }: { driveId: string; closedAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed when the dialog opens rather than during render: reading the
  // clock in a render body is impure, and the suggestion only matters at the
  // moment someone actually opens this.
  const [defaultDate, setDefaultDate] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const raw = String(new FormData(e.currentTarget).get("closesAt") ?? "").trim();
    const res = await fetch(`/api/drives/${driveId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reopen",
        // End of the chosen day, so a deadline of "today" still allows today.
        registrationClosesAt: raw ? new Date(`${raw}T23:59:59`).toISOString() : null,
      }),
    });
    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Couldn't reopen registrations.");
      return;
    }
    toast.success("Registrations reopened. Eligible students have been notified.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A week out is the common case for "giving stragglers another go".
        if (next) setDefaultDate(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <CalendarClock className="size-3.5" /> Reopen registrations
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reopen registrations</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            The drive goes back to <b>Published</b> and eligible students are notified that it is accepting
            applications again.
            {closedAt && (
              <>
                {" "}
                Registration previously closed on{" "}
                <b>{new Date(closedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b>.
              </>
            )}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closesAt">New closing date</Label>
            <Input key={defaultDate} id="closesAt" name="closesAt" type="date" defaultValue={defaultDate} />
            <p className="text-muted-foreground text-xs">
              Leave empty to keep it open until you close it by hand. A date in the past would block every
              application, so the old one is always replaced.
            </p>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Reopening…" : "Reopen registrations"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
