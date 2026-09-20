"use client";

import { useState } from "react";
import Link from "next/link";
import { User, KeyRound, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { PushNotificationMenuItem } from "@/components/pwa/push-notification-menu-item";
import { disablePushForCurrentUser } from "@/lib/pwa/push-client";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  role,
  avatarUrl,
}: {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function handleLogout() {
    setPending(true);
    await disablePushForCurrentUser().catch(() => undefined);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/sign-in";
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="hover:bg-accent flex max-w-56 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors">
            <div className="hidden min-w-0 max-w-40 text-right leading-tight min-[1800px]:block">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="text-muted-foreground truncate text-xs">{role}</div>
            </div>
            <Avatar className="ring-border h-8 w-8 ring-1">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="bg-accent text-accent-foreground">{initials(name)}</AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-foreground text-sm font-medium">{name}</span>
            <span className="truncate text-xs font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
          <KeyRound />
          Change Password
        </DropdownMenuItem>
        <PushNotificationMenuItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onClick={handleLogout}>
          <LogOut />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
