const CACHE_VERSION = 'kioske-dev'; // remplacé au build par une empreinte du contenu (kioske/construction.py)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/rss.html',
  '/theme.js',
  '/pluie.js',
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

  // Fichiers d'autres sites (images des sources) : le navigateur les gère, pas le service worker
  if (url.origin !== self.location.origin) {
    return;
  }

  // Pages HTML et articles : network-first (chercher le frais en priorité)
  // theme.js : son code change avec les réglages de la page (galeries, mode sobre) ; une copie ancienne
  // en cache ferait réapparaître ce que le visiteur a masqué (seul Ctrl+Maj+R la remplaçait).
  // articles-index.json (recherche, favoris) et robots.txt changent à chaque build sans que la version du
  // cache change : en cache-first, ils resteraient figés (nouveaux articles absents de la recherche).
  if (url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.txt') ||
      url.pathname === '/theme.js' ||
      url.pathname.endsWith('/') ||
      url.pathname.includes('/img/') ||
      url.pathname.includes('/rss.xml') ||
      url.pathname.endsWith('.xml')) {
    // cache: 'no-cache' : le navigateur revérifie auprès du serveur au lieu de répondre avec sa copie HTTP
    // (sinon une page peut rester ancienne jusqu'à 30 min, et ses nouvelles tuiles n'apparaissent pas).
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
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
