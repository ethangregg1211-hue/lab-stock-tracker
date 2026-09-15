// Bump CACHE_NAME when icons or manifest change.
// Code files use network-first and update on every reload without a version bump.
const CACHE_NAME = 'labscan-v19';

// Only icons and manifest are precached — api.js and config.js are gitignored.
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
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Don't intercept cross-origin requests (CDN libs, Claude API).
  if (url.origin !== self.location.origin) return;

  // Navigation requests (home screen launch, page reload):
  // Try network first; fall back to cached index.html so the app loads offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(e.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // Icons and manifest: cache-first.
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

  // Everything else (JS, CSS): network-first so code changes show on next reload.
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
