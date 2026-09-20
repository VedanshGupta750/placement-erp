"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const res = await fetch(`/api/message-templates/${templateId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={handleDelete} aria-label="Delete template">
      <Trash2 className="text-muted-foreground size-3.5" />
    </Button>
  );
}
