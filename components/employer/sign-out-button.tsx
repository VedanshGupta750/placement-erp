"use client";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function handleSignOut() {
    await fetch("/api/employer/auth/logout", { method: "POST" });
    window.location.href = "/employer/sign-in";
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
