"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReplyForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return;
    setPending(true);
    const res = await fetch(`/api/forums/posts/${postId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setPending(false);
    if (res.ok) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea name="body" placeholder="Write a reply…" rows={2} disabled={pending} />
      <Button type="submit" size="sm" className="w-fit" disabled={pending}>{pending ? "Posting…" : "Reply"}</Button>
    </form>
  );
}
