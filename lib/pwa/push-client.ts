function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

// iPadOS 13+ reports itself as a Mac, so the user-agent alone is not enough.
export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Why push cannot be enabled here, or null when it can.
 *
 * Safari exposes PushManager only inside an installed web app (iOS/iPadOS
 * 16.4+), so on iOS this has to explain the Add to Home Screen step instead of
 * silently hiding the control or failing with a bare NotAllowedError.
 */
export function webPushBlockReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    return "This browser does not support background notifications.";
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return "On iPhone and iPad, notifications work only in the installed app. Tap Share, choose Add to Home Screen, then open it from there and turn notifications on.";
  }
  if (!("PushManager" in window) || !("Notification" in window)) {
    return isIosDevice()
      ? "Update to iOS 16.4 or later to receive notifications."
      : "This browser does not support push notifications.";
  }
  return null;
}

export function supportsWebPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushSubscription() {
  if (!supportsWebPush()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePushForCurrentUser() {
  const blocked = webPushBlockReason();
  if (blocked) throw new Error(blocked);
  if (Notification.permission === "denied") {
    throw new Error("Notifications are blocked. Enable them in your browser or phone settings.");
  }

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const configResponse = await fetch("/api/push/subscriptions", { cache: "no-store" });
  const config = await configResponse.json().catch(() => ({}));
  if (!configResponse.ok || !config.configured || !config.publicKey) {
    throw new Error(config.message || "Push notifications are not configured yet.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }));

  const serialized = subscription.toJSON();
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: serialized.keys,
      deviceName: isIosDevice()
        ? "iPhone or iPad"
        : /android/i.test(navigator.userAgent)
          ? "Android device"
          : "Web browser",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error(data.message || "Could not enable notifications.");
  }
  return subscription;
}

export async function disablePushForCurrentUser() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;

  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe();
}

