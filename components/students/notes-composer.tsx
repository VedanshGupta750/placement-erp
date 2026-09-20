"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotesComposer({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    const res = await fetch(`/api/students/${studentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setPending(false);
    if (res.ok) {
      setBody("");
      toast.success("Note added.");
      router.refresh();
    } else {
      toast.error("Couldn't add note.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note — not visible to the student…" rows={3} />
      <Button type="button" size="sm" className="w-fit" disabled={pending || !body.trim()} onClick={submit}>
        {pending ? "Adding…" : "Add note"}
      </Button>
    </div>
  );
}
