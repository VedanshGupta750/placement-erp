"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type Note = { id: string; body: string; createdAt: string; authorName: string };

export function ApplicationNotesTab({ applicationId, notes, canAdd }: { applicationId: string; notes: Note[]; canAdd: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    const res = await fetch(`/api/applications/${applicationId}/notes`, {
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
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {canAdd && (
          <div className="flex flex-col gap-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note…" rows={3} />
            <Button size="sm" className="w-fit" disabled={pending || !body.trim()} onClick={submit}>{pending ? "Saving…" : "Add note"}</Button>
          </div>
        )}
        <div className="flex flex-col divide-y">
          {notes.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="py-2.5 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-muted-foreground mt-1 text-xs">{n.authorName} · {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
