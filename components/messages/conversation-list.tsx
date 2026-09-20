"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Search, Star, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { NewMessageDialog } from "@/components/messages/new-message-dialog";
import { cn } from "@/lib/utils";

export type ConversationTypeDot = "green" | "gray" | "blue" | "violet" | "slate";

export type ConversationListItem = {
  id: string;
  kind: "conversation" | "contact";
  href: string;
  displayName: string;
  subtitle?: string;
  preview: string;
  lastActivity: string; // ISO
  unread: boolean;
  unreadCount: number;
  starred: boolean;
  isGroup: boolean;
  typeDot: ConversationTypeDot;
  initials: string;
  avatarUrl?: string;
};

type ListTab = "all" | "unread" | "starred" | "groups";

const DOT_CLASSES: Record<ConversationTypeDot, string> = {
  green: "bg-emerald-500",
  gray: "bg-muted-foreground/40",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
};

function formatTimestamp(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ConversationList({ items, canCreateGroup }: { items: ConversationListItem[]; canCreateGroup: boolean }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ListTab>("all");
  const [starOverrides, setStarOverrides] = useState<Record<string, boolean>>({});

  const resolvedItems = useMemo(
    () => items.map((item) => (item.id in starOverrides ? { ...item, starred: starOverrides[item.id] } : item)),
    [items, starOverrides],
  );

  const counts = useMemo(
    () => ({
      all: resolvedItems.length,
      unread: resolvedItems.filter((i) => i.kind === "conversation" && i.unread).length,
      starred: resolvedItems.filter((i) => i.kind === "conversation" && i.starred).length,
      groups: resolvedItems.filter((i) => i.kind === "conversation" && i.isGroup).length,
    }),
    [resolvedItems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resolvedItems.filter((item) => {
      if (tab === "unread" && !(item.kind === "conversation" && item.unread)) return false;
      if (tab === "starred" && !(item.kind === "conversation" && item.starred)) return false;
      if (tab === "groups" && !(item.kind === "conversation" && item.isGroup)) return false;
      if (!q) return true;
      return item.displayName.toLowerCase().includes(q) || (item.subtitle ?? "").toLowerCase().includes(q);
    });
  }, [resolvedItems, tab, query]);

  async function toggleStar(item: ConversationListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !item.starred;
    setStarOverrides((prev) => ({ ...prev, [item.id]: next }));
    const res = await fetch(`/api/messages/${item.id}/star`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    });
    if (!res.ok) {
      setStarOverrides((prev) => ({ ...prev, [item.id]: item.starred }));
      toast.error("Couldn't update star.");
    }
  }

  const tabs: { key: ListTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "unread", label: "Unread", count: counts.unread },
    { key: "starred", label: "Starred", count: counts.starred },
    { key: "groups", label: "Groups", count: counts.groups },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h1 className="text-lg font-semibold tracking-tight">Messages</h1>
        <NewMessageDialog canCreateGroup={canCreateGroup} />
      </div>

      <div className="border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages"
            className="pl-8"
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b p-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px]",
                  tab === t.key ? "bg-primary-foreground/20" : "bg-muted-foreground/20",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-12 text-center text-sm">
            <MessageSquare className="size-6" />
            {query ? "No conversations match your search." : "No conversations here yet."}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      "hover:bg-accent/40 flex items-start gap-2.5 px-3 py-2.5 transition-colors",
                      active && "bg-accent/60",
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar>
                        {item.avatarUrl ? <AvatarImage src={item.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {item.isGroup ? <Users2 className="size-4" /> : item.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "border-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2",
                          DOT_CLASSES[item.typeDot],
                        )}
                        aria-hidden
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", item.unread ? "font-semibold" : "font-medium")}>
                          {item.displayName}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[11px]">{formatTimestamp(item.lastActivity)}</span>
                      </div>
                      {item.subtitle && <div className="text-muted-foreground truncate text-xs">{item.subtitle}</div>}
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-xs", item.unread ? "text-foreground" : "text-muted-foreground")}>
                          {item.preview}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {item.kind === "conversation" && (
                            <button
                              type="button"
                              onClick={(e) => toggleStar(item, e)}
                              className={cn(
                                "text-muted-foreground/50 hover:text-foreground transition-colors",
                                item.starred && "text-amber-500 hover:text-amber-500",
                              )}
                              aria-label={item.starred ? "Unstar conversation" : "Star conversation"}
                            >
                              <Star className="size-3.5" fill={item.starred ? "currentColor" : "none"} />
                            </button>
                          )}
                          {item.unreadCount > 0 && (
                            <span className="bg-primary text-primary-foreground inline-flex min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-medium">
                              {item.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
