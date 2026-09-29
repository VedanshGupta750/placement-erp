"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Notification = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
    if ("setAppBadge" in navigator) {
      if (data.unreadCount > 0) await navigator.setAppBadge(data.unreadCount).catch(() => undefined);
      else if ("clearAppBadge" in navigator) await navigator.clearAppBadge().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    // 60s was long enough that a request raised in another tab looked like
    // it had never arrived. Polling is now 20s and, more importantly, the
    // bell also refreshes whenever the window regains focus — which is what
    // actually happens when a TPO switches back to the tab.
    const interval = window.setInterval(() => void load(), 20000);
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION_RECEIVED") void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [load]);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="relative" />}>
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-muted-foreground text-xs hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="text-muted-foreground p-4 text-center text-sm">No notifications yet.</p>
          )}
          {notifications.map((n) => {
            const content = (
              <div className={`flex flex-col gap-0.5 border-b px-3 py-2.5 text-sm last:border-0 ${n.readAt ? "" : "bg-accent/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{n.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(n.createdAt)}</span>
                </div>
                <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">{n.body}</span>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={() => !n.readAt && markRead(n.id)}>
                {content}
              </Link>
            ) : (
              <button key={n.id} className="w-full text-left" onClick={() => !n.readAt && markRead(n.id)}>
                {content}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
