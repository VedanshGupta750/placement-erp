"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, FileText, Home, MessageSquare, MoreHorizontal, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PWA_CONFIG } from "@/lib/pwa/config";

const STUDENT_MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/opportunities", label: "Jobs", icon: Briefcase },
  { href: "/applications", label: "Applied", icon: FileText },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

const STAFF_MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/students", label: "Students", icon: Users },
  { href: "/drives", label: "Drives", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

export function DashboardShell({
  logo,
  nav,
  orgName,
  orgLogoUrl,
  headerCenter,
  headerRight,
  userType,
  children,
}: {
  logo: React.ReactNode;
  nav: React.ReactNode;
  orgName: string;
  orgLogoUrl?: string | null;
  headerCenter?: React.ReactNode;
  headerRight: React.ReactNode;
  userType: "STUDENT" | "FACULTY" | "MANAGEMENT" | "PLACEMENT_TEAM";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const locationKey = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);
  const mobileItems = userType === "STUDENT" ? STUDENT_MOBILE_NAV : STAFF_MOBILE_NAV;
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  // The dashboard uses its own scrolling main element rather than the
  // window. Remember each section's position so a query-string update,
  // detail-page visit, or browser Back action returns the user to the item
  // they were working with. Hash links still take priority (for example,
  // View Event jumps directly to #event-details).
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const restore = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        document.getElementById(hash)?.scrollIntoView({ block: "start" });
        return;
      }

      const saved = Number(sessionStorage.getItem(`dashboard-scroll:${pathname}`));
      main.scrollTop = Number.isFinite(saved) ? saved : 0;
    };

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(restore);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [locationKey, pathname]);

  function rememberScroll() {
    if (window.location.hash) return;
    const main = mainRef.current;
    if (main) sessionStorage.setItem(`dashboard-scroll:${pathname}`, String(main.scrollTop));
  }

  function preserveSamePageNavigation(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || destination.hash) return;

    event.preventDefault();
    rememberScroll();
    router.push(`${destination.pathname}${destination.search}`, { scroll: false });
  }

  return (
    <div className="bg-background flex h-dvh min-h-0 w-full overflow-hidden" onClickCapture={preserveSamePageNavigation}>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-dvh min-h-0 w-60 shrink-0 flex-col overflow-hidden border-r px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out lg:static lg:translate-x-0 print:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-7 flex shrink-0 items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            {logo}
          </Link>
          <button
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground -mr-2 flex size-10 items-center justify-center rounded-xl transition-colors lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-4 [scrollbar-gutter:stable] [scrollbar-width:thin]"
          onClick={() => setOpen(false)}
        >
          {nav}
        </div>
      </aside>

      <div className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 shrink-0 min-w-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6 print:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:w-52 lg:flex-none xl:w-64 2xl:w-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={orgLogoUrl || PWA_CONFIG.logoPath}
              alt=""
              className="h-7 w-12 shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-border"
            />
            <span className="text-muted-foreground min-w-0 truncate text-sm font-medium">{orgName}</span>
          </div>
          {headerCenter && <div className="hidden min-w-0 flex-1 justify-center px-2 xl:px-3 lg:flex">{headerCenter}</div>}
          <div className="shrink-0">{headerRight}</div>
        </header>
        {headerCenter && (
          <div className="bg-background/95 relative z-20 shrink-0 border-b px-4 py-2 backdrop-blur-md sm:px-6 lg:hidden print:hidden">
            {headerCenter}
          </div>
        )}
        <main
          ref={mainRef}
          onScroll={rememberScroll}
          className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] [scrollbar-gutter:stable] sm:px-6 sm:py-8 lg:pb-24"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary navigation"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-start justify-around border-t px-1 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden print:hidden"
      >
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[0.65rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "fill-primary/12")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[0.65rem] font-medium"
          aria-label="Open all sections"
        >
          <MoreHorizontal className="size-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
