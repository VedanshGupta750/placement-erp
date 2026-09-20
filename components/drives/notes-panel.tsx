"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Note = { id: string; body: string; createdAt: string; author: { name: string } };

export function NotesPanel({ driveId, notes, canEdit }: { driveId: string; notes: Note[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [body, setBody] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    const res = await fetch(`/api/drives/${driveId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setPending(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      toast.error("Couldn't post note.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write any additional comments / notes here"
            rows={3}
          />
          <Button type="submit" size="sm" className="w-fit" disabled={pending || !body.trim()}>
            {pending ? "Posting…" : "Post"}
          </Button>
        </form>
      )}
      <div className="flex flex-col gap-3">
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{n.author.name}</span>
              <span className="text-muted-foreground text-xs">{new Date(n.createdAt).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</p>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <MessageSquare className="size-4" /> No comments / notes have been posted till now.
          </p>
        )}
      </div>
    </div>
  );
}
