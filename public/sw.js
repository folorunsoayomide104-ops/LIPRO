// Bump this on every meaningful change to this file's own caching logic —
// changing it is what makes the browser's existing service worker discover
// an update, install it, and (via the activate handler below) evict every
// cache entry from the previous version. A stable name here is what let
// stale JS/CSS survive indefinitely across deploys: hashed asset filenames
// change per build, but "cache-first, no expiry" for a URL the client had
// already cached under the *old* SW instance never got revisited, and if a
// shared chunk's hash was ever reused a browser could keep serving whatever
// it fetched the first time that URL existed — this is what makes that
// self-heal instead of require a manual "clear site data".
const CACHE = 'lipro-shell-v2';
const SHELL = ['/', '/login', '/register', '/dashboard', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first with cached fallback for offline. Falls back
  // to the cache entry for the actual requested page, not always /dashboard
  // — the previous version hardcoded /dashboard here, so an offline visit
  // to any other page (e.g. /login) got silently served the dashboard shell
  // instead of a real "you're offline" outcome for that page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate, not pure cache-first. Serves the
  // cached copy immediately if present (fast), but always also fetches in
  // the background and updates the cache for next time — so even if a URL
  // is ever cached with the wrong content, the very next load self-heals
  // instead of serving that same stale response forever.
  if (/\.(png|svg|ico|webp|js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              cache.put(request, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
