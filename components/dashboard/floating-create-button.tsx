"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Plus, Briefcase, Megaphone, CalendarPlus, UserPlus, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

type Action = { href: string; label: string; icon: typeof Plus };

const ACTIONS: Action[] = [
  { href: "/drives/new", label: "New drive", icon: Briefcase },
  { href: "/broadcasts", label: "New broadcast", icon: Megaphone },
  { href: "/events", label: "New event post", icon: CalendarPlus },
  { href: "/people", label: "Invite people", icon: UserPlus },
];

export function FloatingCreateButton({ showCopilot = false }: { showCopilot?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  function toggleMobileActions() {
    setMobileOpen((current) => !current);
    setMobileCreateOpen(false);
  }

  function openMobileCopilot() {
    setMobileOpen(false);
    setMobileCreateOpen(false);
    window.dispatchEvent(new Event("open-tpo-copilot"));
  }

  return (
    <div
      className={cn(
        "fixed right-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2 sm:right-4 lg:bottom-4 print:hidden",
        pathname.startsWith("/messages") && "max-lg:hidden",
      )}
    >
        {mobileCreateOpen && (
          <div className="bg-popover text-popover-foreground w-52 rounded-2xl border p-1.5 shadow-xl">
            {ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => {
                  setMobileCreateOpen(false);
                  setMobileOpen(false);
                }}
                className="hover:bg-accent flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors"
              >
                <action.icon className="text-muted-foreground size-4" />
                {action.label}
              </Link>
            ))}
          </div>
        )}

        {mobileOpen && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileCreateOpen((current) => !current)}
              className="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-lg"
            >
              <Plus className="size-4" /> Create
            </button>
            {showCopilot && (
              <button
                type="button"
                onClick={openMobileCopilot}
                className="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-lg"
              >
                <Bot className="size-4" /> Ask AI
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={toggleMobileActions}
          aria-label={mobileOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={mobileOpen}
          className={cn(
            "bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-95",
            mobileOpen
              ? "translate-x-0 opacity-100"
              : "translate-x-2 opacity-60 hover:translate-x-0 hover:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100",
          )}
        >
          <Plus className={`size-5 transition-transform duration-200 ${mobileOpen ? "rotate-45" : ""}`} />
        </button>
    </div>
  );
}
