const CACHE_NAME = 'finwise-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './dashboard.html',
  './transactions.html',
  './reports.html',
  './rates.html',
  './manifest.json',
  './assets/css/base.css',
  './assets/css/layout.css',
  './assets/css/components.css',
  './assets/css/pages.css',
  './assets/js/config.js',
  './assets/js/api.js',
  './assets/js/auth.js',
  './assets/js/dashboard.js',
  './assets/js/transactions.js',
  './assets/js/reports.js',
  './assets/js/rates.js',
  './assets/js/offline-sync.js',
  './assets/js/capture-parser.js',
  './assets/js/budgets.js',
  './assets/js/data-transfer.js',
  './assets/js/calculators.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let API requests pass directly to network (handled by offline-sync.js on failure)
  if (event.request.url.includes('/api/v1/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {
          // Ignore offline fetch errors during background revalidation
        });
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for HTML pages
        if (event.request.mode === 'navigate') {
          return caches.match('./dashboard.html') || caches.match('./index.html');
        }
      });
    })
  );
});
