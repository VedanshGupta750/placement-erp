"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ResumeRowActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setDefault() {
    setPending(true);
    const res = await fetch(`/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Default resume updated");
      router.refresh();
    } else {
      toast.error("Couldn't update default resume.");
    }
  }

  async function remove() {
    if (!confirm("Delete this resume? This can't be undone.")) return;
    setPending(true);
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      toast.success("Resume deleted");
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't delete this resume.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {!isDefault && (
        <Button size="sm" variant="outline" disabled={pending} onClick={setDefault}>
          Set default
        </Button>
      )}
      <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={remove}>
        Delete
      </Button>
    </div>
  );
}
