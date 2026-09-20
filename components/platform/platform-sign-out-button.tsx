"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlatformSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await fetch("/api/platform/auth/logout", { method: "POST" });
    router.push("/platform/sign-in");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleSignOut}>
      <LogOut className="size-3.5" /> Sign out
    </Button>
  );
}
