"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  currentPushSubscription,
  disablePushForCurrentUser,
  enablePushForCurrentUser,
  isIosDevice,
  webPushBlockReason,
} from "@/lib/pwa/push-client";

type State = "loading" | "unsupported" | "blocked" | "off" | "on" | "busy";

export function PushNotificationMenuItem() {
  const [state, setState] = useState<State>("loading");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    const reason = webPushBlockReason();
    if (reason) {
      // On iPhone/iPad the control stays visible and explains the Add to Home
      // Screen step; anywhere else the feature genuinely does not exist, so
      // there is nothing useful to show.
      setBlockedReason(reason);
      queueMicrotask(() => setState(isIosDevice() ? "blocked" : "unsupported"));
      return;
    }
    currentPushSubscription()
      .then((subscription) => setState(subscription ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function toggle() {
    if (state === "blocked") {
      toast.info(blockedReason ?? "Install the app to turn on notifications.");
      return;
    }
    if (state === "busy" || state === "loading" || state === "unsupported") return;
    const wasOn = state === "on";
    setState("busy");
    try {
      if (wasOn) {
        await disablePushForCurrentUser();
        setState("off");
        toast.success("Device notifications turned off");
      } else {
        await enablePushForCurrentUser();
        setState("on");
        toast.success("Device notifications are on");
      }
    } catch (error) {
      setState(wasOn ? "on" : "off");
      toast.error(error instanceof Error ? error.message : "Could not update notifications.");
    }
  }

  if (state === "unsupported") return null;

  return (
    <DropdownMenuItem onClick={toggle} disabled={state === "busy" || state === "loading"}>
      {state === "busy" || state === "loading" ? (
        <LoaderCircle className="animate-spin" />
      ) : state === "on" ? (
        <BellRing />
      ) : (
        <BellOff />
      )}
      {state === "on"
        ? "Device notifications on"
        : state === "blocked"
          ? "Notifications — install app first"
          : "Enable device notifications"}
    </DropdownMenuItem>
  );
}
