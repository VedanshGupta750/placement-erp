"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function NotificationInlineCard({
  id,
  title,
  body,
  link,
}: {
  id: string;
  title: string;
  body: string;
  link: string | null;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  async function dismiss() {
    setDismissed(true);
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    router.refresh();
  }

  if (dismissed) return null;

  const content = (
    <CardContent className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-muted-foreground line-clamp-1 text-xs">{body}</div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dismiss();
        }}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </CardContent>
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      {link ? <Link href={link}>{content}</Link> : content}
    </Card>
  );
}
