"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CreateCollegeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/platform/colleges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collegeName: fd.get("collegeName"),
        tpoName: fd.get("tpoName"),
        tpoEmail: fd.get("tpoEmail"),
        tpoPassword: fd.get("tpoPassword"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const fieldMessage = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>).flat()[0]
        : undefined;
      setError(data.message ?? fieldMessage ?? "Couldn't create the college.");
      return;
    }

    toast.success("College created. Share the TPO's password with them directly.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" /> New college
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a college</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Provisions the college, its system roles, a default campus, department and batch, plus the first TPO account.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collegeName">College name</Label>
            <Input id="collegeName" name="collegeName" required minLength={2} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpoName">TPO name</Label>
            <Input id="tpoName" name="tpoName" required minLength={2} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpoEmail">TPO email</Label>
            <Input id="tpoEmail" name="tpoEmail" type="email" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpoPassword">Initial TPO password</Label>
            <Input id="tpoPassword" name="tpoPassword" type="password" required autoComplete="new-password" />
            <p className="text-muted-foreground text-xs">
              At least 8 characters, with a letter and a number. Pass it to the TPO directly — it isn&apos;t emailed.
            </p>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Creating…" : "Create college"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
