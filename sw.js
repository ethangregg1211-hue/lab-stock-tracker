// Bump CACHE_NAME only when icons or manifest change.
// Code files (JS/CSS/HTML) use network-first, so they update on every reload
// without requiring a version bump here.
const CACHE_NAME = 'labscan-v18';

// Only truly static assets are precached — icons and manifest rarely change.
// api.js and config.js are gitignored and must NOT be listed here.
const PRECACHE_ASSETS = [
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './favicon-16.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => console.warn('[SW] Precache partial failure:', err))
  );
  // Activate immediately — don't wait for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Delete every cache that isn't the current version.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // Take control of already-open tabs right away.
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Don't intercept cross-origin requests (CDN libs — SheetJS, Tabler icons —
  // and the Claude API endpoint).
  if (url.origin !== self.location.origin) return;

  // Icons and manifest: cache-first (safe because they change rarely and only
  // when CACHE_NAME is bumped anyway, which clears the old cache).
  if (
    url.pathname.match(/\.(png|ico|jpg|jpeg|svg|webp)$/) ||
    url.pathname.endsWith('manifest.json')
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            caches.open(CACHE_NAME).then((c) => c.put(e.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (index.html, style.css, app.js, camera.js, excel.js, db.js):
  // network-first so code changes show up on next reload, with cache as offline fallback.
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
