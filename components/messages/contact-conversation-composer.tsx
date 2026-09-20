"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ContactConversationComposer({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setPending(true);
    const res = await fetch(`/api/contacts/${contactId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "MESSAGE", body: trimmed }),
    });
    setPending(false);
    if (res.ok) {
      setBody("");
      router.refresh();
      toast.success("Message logged.");
    } else {
      toast.error("Couldn't log message.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t pt-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a message to log for this contact…"
        rows={3}
        disabled={pending}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          This is logged to the contact&apos;s record — it isn&apos;t delivered to them automatically.
        </p>
        <Button type="submit" disabled={pending || !body.trim()} className="w-full shrink-0 sm:w-auto">
          {pending ? "Logging…" : "Log message"}
        </Button>
      </div>
    </form>
  );
}
