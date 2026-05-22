const CACHE_NAME = "gestionale-turni-v2";
const API_CACHE_NAME = "gestionale-api-v2";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Supabase API endpoints to cache (stale-while-revalidate, TTL 5 min)
const CACHEABLE_API_PATTERNS = [
  /\/rest\/v1\/shifts/,
  /\/rest\/v1\/employees/,
  /\/rest\/v1\/profiles/,
  /\/rest\/v1\/stores/,
  /\/rest\/v1\/store_settings/,
  /\/rest\/v1\/coverage_requirements/,
  /\/rest\/v1\/opening_hours/,
  /\/rest\/v1\/allowed_shift_times/,
  /\/rest\/v1\/time_off_requests/,
  /\/rest\/v1\/schedule_periods/,
];

const API_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isCacheableApiRequest(url) {
  return (
    url.method === "GET" &&
    CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname + url.search))
  );
}

function isExpired(response) {
  const cachedAt = response.headers.get("sw-cached-at");
  if (!cachedAt) return true;
  return Date.now() - parseInt(cachedAt, 10) > API_CACHE_TTL_MS;
}

async function cacheApiResponse(cache, request, response) {
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", String(Date.now()));
  const clonedBody = await response.clone().arrayBuffer();
  const cachedResponse = new Response(clonedBody, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  cache.put(request, cachedResponse);
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Network-first for navigation (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/") ?? fetch(request))
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

  // Stale-while-revalidate for cacheable Supabase API GET requests
  if (url.origin !== self.location.origin && isCacheableApiRequest(url)) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);

        const networkFetch = fetch(request)
          .then((response) => cacheApiResponse(cache, request, response))
          .catch(() => null);

        // Return stale cache immediately if available and not too old
        if (cached && !isExpired(cached)) {
          // Revalidate in background
          networkFetch;
          return cached;
        }

        // No usable cache — wait for network, fall back to stale on failure
        const fresh = await networkFetch;
        if (fresh) return fresh;
        if (cached) return cached; // serve stale rather than error
        return new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
  }
});
