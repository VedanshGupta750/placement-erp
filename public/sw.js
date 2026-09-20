const CACHE_NAME = "placement-erp-shell-v5";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [OFFLINE_URL];

// Priming the offline shell is best effort. `cache.addAll()` rejects the whole
// batch on any single failure (and on Chrome can reject outright with
// "Entry already exists" when two installs race), which rejects the
// `install` waitUntil and leaves the worker redundant — no active worker means
// no offline page, no push, and no install prompt, since Chrome and Edge only
// fire `beforeinstallprompt` for an origin with an active fetch-handling
// worker. Cache each entry on its own and swallow failures so installation
// always completes.
async function primeOfflineShell() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      STATIC_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
          if (response.ok) await cache.put(url, response);
        } catch {
          // Offline or blocked at install time; the runtime handler retries.
        }
      }),
    );
  } catch {
    // Cache storage can be unavailable (private browsing, quota). Install anyway.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(primeOfflineShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        if (cached) return cached;
        // The shell never cached (install ran offline, or storage is blocked).
        // Return something rather than a network error, which iOS renders as a
        // blank page.
        return new Response(
          "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Offline</title><body style=\"font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0\"><p>You are offline. Reconnect and try again.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
        );
      }),
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Placement ERP", body: event.data.text(), link: "/dashboard" };
  }

  const link = typeof payload.link === "string" && payload.link.startsWith("/") && !payload.link.startsWith("//")
    ? payload.link
    : "/dashboard";
  const title = typeof payload.title === "string" ? payload.title : "Placement ERP";
  const body = typeof payload.body === "string" ? payload.body : "You have a new update.";

  event.waitUntil((async () => {
    let icon = "/pwa/icon-512.png";
    try {
      const response = await fetch("/manifest.webmanifest", { cache: "no-store" });
      const manifest = await response.json();
      if (typeof manifest.icons?.[0]?.src === "string") icon = manifest.icons[0].src;
    } catch {
      // Keep the bundled fallback icon when branding cannot be loaded.
    }

    await Promise.all([
      self.registration.showNotification(title, {
        body,
        icon,
        badge: "/pwa/badge-96.png",
        tag: typeof payload.tag === "string" ? payload.tag : undefined,
        data: { link, notificationId: payload.notificationId },
      }),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "PUSH_NOTIFICATION_RECEIVED" }));
      }),
    ]);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawLink = event.notification.data && event.notification.data.link;
  const link = typeof rawLink === "string" && rawLink.startsWith("/") && !rawLink.startsWith("//")
    ? rawLink
    : "/dashboard";
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
