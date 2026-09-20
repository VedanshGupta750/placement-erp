"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RemoveMemberButton({ departmentId, membershipId }: { departmentId: string; membershipId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    setPending(true);
    const res = await fetch(`/api/departments/${departmentId}/members/${membershipId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={handleRemove} aria-label="Remove member">
      <Trash2 className="text-muted-foreground size-3.5" />
    </Button>
  );
}
