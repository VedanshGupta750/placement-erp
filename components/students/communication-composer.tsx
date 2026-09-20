"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommunicationComposer({ recipientUserId }: { recipientUserId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setPending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUserId, body: body.trim() }),
    });
    setPending(false);
    if (res.ok) {
      setBody("");
      toast.success("Message sent.");
      router.refresh();
    } else {
      toast.error("Couldn't send message.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message this student…" rows={3} />
      <Button type="button" size="sm" className="w-fit" disabled={pending || !body.trim()} onClick={send}>
        {pending ? "Sending…" : "Send"}
      </Button>
    </div>
  );
}
