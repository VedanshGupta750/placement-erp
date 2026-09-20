"use client";

import { Download } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/pwa-runtime";
import { cn } from "@/lib/utils";

// Standalone install pill for pages outside the dashboard shell (sign-in,
// sign-up). `browser-only-install` hides it once the app is running installed,
// where there is nothing left to install.
export function InstallAppButton({ className }: { className?: string }) {
  const { installing, install } = usePwaInstall();

  return (
    <button
      type="button"
      onClick={() => void install()}
      disabled={installing}
      className={cn(
        "browser-only-install bg-primary/10 text-primary hover:bg-primary/15 inline-flex max-w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        className,
      )}
    >
      <Download className="size-4 shrink-0" />
      <span className="truncate">{installing ? "Opening installer…" : "Install app"}</span>
    </button>
  );
}
