const CACHE_NAME = "gestionale-turni-v1";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
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

  // Skip non-GET, cross-origin, and Supabase API requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/storage/")) return;

  // Network-first for navigation (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/") ?? fetch(request))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, icons)
  if (url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
