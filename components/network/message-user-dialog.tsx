"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

export function MessageUserDialog({
  userId,
  userName,
  triggerClassName,
}: {
  userId: string;
  userName: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUserId: userId, body: fd.get("body") }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      setOpen(false);
      router.push(`/messages/${data.conversationId}`);
    } else {
      toast.error("Couldn't send message.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" className={triggerClassName} onClick={() => setOpen(true)}>
        <MessageSquare className="size-3.5" /> Message
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Textarea name="body" rows={3} placeholder="Write a message…" required />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
