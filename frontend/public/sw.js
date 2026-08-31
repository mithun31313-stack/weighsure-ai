// WeighSure AI service worker
// Scope: offline access to the app shell (so the UI still loads with no
// network) and cached read access to GET /api/* responses (so dashboard,
// instruments, tests, reports remain viewable offline using last-seen data).
//
// Explicitly NOT in scope: queuing writes made while offline for later sync.
// A POST/PUT made offline fails immediately and the UI should surface that —
// building a reliable offline write queue with conflict resolution is a
// separate, much larger feature.

const CACHE_NAME = "weighsure-cache-v1";
const APP_SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept non-GET requests — mutations always go straight to the
  // network; if the network is down, they fail visibly rather than silently
  // queuing (see note above).
  if (request.method !== "GET") return;

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // SPA navigations: try network, fall back to the cached app shell so the
  // React app itself still boots offline (it'll show cached data for
  // whatever screen loads, per the API caching below).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  // GET /api/*: network-first, cache the successful response, fall back to
  // the last cached copy when offline. This is what makes Dashboard,
  // Instruments, Tests, Reports viewable with no connection.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (hashed JS/CSS/icons): stale-while-revalidate — serve
  // from cache immediately if present, and refresh the cache in the
  // background for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
