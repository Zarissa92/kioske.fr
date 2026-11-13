const CACHE_VERSION = 'kioske-v12';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/rss.html',
  '/style.css',
  '/pluie.css',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/preview.png',
  '/manifest.json',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-192.png',
  '/icon-256.png',
  '/icon-512.png',
  '/fonts/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Si certains assets ne peuvent pas être cachés, continuer quand même
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne cacher que les requêtes GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Pages HTML et articles : network-first (chercher le frais en priorité)
  if (url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.includes('/img/') ||
      url.pathname.includes('/rss.xml') ||
      url.pathname.includes('/rss/') ||
      url.pathname.endsWith('.xml')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Assets (CSS, JS, images, fonts, icônes) : cache-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
