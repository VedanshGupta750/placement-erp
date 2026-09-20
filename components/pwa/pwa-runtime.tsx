"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PWA_CONFIG } from "@/lib/pwa/config";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
  }
}

type InstallContextValue = {
  canInstall: boolean;
  installing: boolean;
  install: () => Promise<void>;
};

const InstallContext = createContext<InstallContextValue>({
  canInstall: false,
  installing: false,
  install: async () => {},
});

const INSTALLED_MARKER = "pwa-installed-at";
const IOS_INSTALL_MARKER_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isIosBrowser() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  return useContext(InstallContext);
}

export function PwaRuntime({ children }: { children: ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [ios] = useState(() => typeof navigator !== "undefined" && isIosBrowser());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let removeServiceWorkerListener: (() => void) | undefined;

    if ("serviceWorker" in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloading = false;
      const handleControllerChange = () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      removeServiceWorkerListener = () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);

      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {
          // The application remains usable when service workers are unavailable.
        });
    }

    if (isStandalone()) {
      localStorage.setItem(INSTALLED_MARKER, String(Date.now()));
      return removeServiceWorkerListener;
    }

    const isKnownInstalled = async () => {
      if (navigator.getInstalledRelatedApps) {
        try {
          const installedApps = await navigator.getInstalledRelatedApps();
          if (installedApps.length > 0) {
            localStorage.setItem(INSTALLED_MARKER, String(Date.now()));
            return true;
          }
        } catch {
          // Continue with platform-specific detection when the API is unavailable.
        }
      }

      const installedAt = Number(localStorage.getItem(INSTALLED_MARKER));
      return Number.isFinite(installedAt) && Date.now() - installedAt < IOS_INSTALL_MARKER_MAX_AGE;
    };

    const handleInstallPrompt = async (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      if (cancelled) return;
      setInstallEvent(event);
      setCanInstall(true);
    };

    const handleInstalled = () => {
      localStorage.setItem(INSTALLED_MARKER, String(Date.now()));
      setCanInstall(false);
      setInstallEvent(null);
      setShowInstallInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    void isKnownInstalled().then((installed) => {
      if (!installed && !cancelled) setCanInstall(true);
    });

    return () => {
      cancelled = true;
      removeServiceWorkerListener?.();
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (ios || !installEvent) {
      setShowInstallInstructions(true);
      return;
    }

    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        localStorage.setItem(INSTALLED_MARKER, String(Date.now()));
      }
      setCanInstall(false);
      setInstallEvent(null);
    } finally {
      setInstalling(false);
    }
  }, [installEvent, ios]);

  const contextValue = useMemo(
    () => ({ canInstall, installing, install }),
    [canInstall, installing, install],
  );

  return (
    <InstallContext.Provider value={contextValue}>
      {children}
      {showInstallInstructions && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/35 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="bg-background text-foreground w-full rounded-3xl border p-5 shadow-2xl sm:max-w-md"
          >
            <div className="flex items-start gap-4">
              <Image
                src={PWA_CONFIG.logoPath}
                width={56}
                height={56}
                alt=""
                className="size-14 rounded-2xl bg-white object-contain p-1 shadow-sm ring-1 ring-black/10"
              />
              <div className="min-w-0 flex-1">
                <h2 id="ios-install-title" className="text-lg font-semibold tracking-tight">
                  Install {PWA_CONFIG.shortName}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  {ios
                    ? "Tap the Share button in Safari, choose Add to Home Screen, then tap Add."
                    : "Open the browser menu and choose Install app or Add to Home screen. Installation requires HTTPS; a local-network HTTP address can be used for browser testing only."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallInstructions(false)}
                aria-label="Close install instructions"
                className="hover:bg-muted -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="bg-muted/70 mt-4 flex items-center gap-2 rounded-2xl p-4 text-sm font-medium">
              <Share className="text-primary size-4" />
              {ios ? "Share → Add to Home Screen" : "Browser menu → Install app"}
            </div>
            <Button type="button" className="mt-4 w-full" onClick={() => setShowInstallInstructions(false)}>
              Done
            </Button>
          </section>
        </div>
      )}
    </InstallContext.Provider>
  );
}
