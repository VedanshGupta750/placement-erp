"use client";

import { Download } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/pwa-runtime";

export function InstallAppNavItem() {
  const { installing, install } = usePwaInstall();

  return (
    <div className="browser-only-install mb-2 border-b border-sidebar-border/70 px-0.5 pb-3">
      <button
        type="button"
        onClick={() => void install()}
        disabled={installing}
        className="bg-primary/10 text-primary hover:bg-primary/15 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
      >
        <Download className="size-4 shrink-0" />
        <span>{installing ? "Opening installer…" : "Directly install app"}</span>
        <span className="bg-background/70 ml-auto rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
          Optional
        </span>
      </button>
    </div>
  );
}
